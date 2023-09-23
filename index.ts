import {launch} from "puppeteer";
import {PrismaClient} from "@prisma/client";

const timestamp = new Date()

const browser = await launch({
    args: ["--no-sandbox", "--disable-setuid-sandobx"],
})

const Store = ['MediaMarkt', 'MediaExpert', 'Euro', 'Play'] as const

type Store = typeof Store[number]

const Stores = {
    MediaExpert: {
        link: 'https://www.mediaexpert.pl/smartfony-i-zegarki/smartfony/smartfon-apple-iphone-15-pro-max-256gb-5g-6-7-120hz-tytan-naturalny#topVariants',
        name: 'Media Expert'
    },
    MediaMarkt: {
        link: 'https://mediamarkt.pl/telefony-i-smartfony/smartfon-apple-iphone-15-pro-max-256gb-tytan-naturalny-mu793px-a',
        name: 'Media Markt',
    },
    Euro: {
        // link: 'https://www.euro.com.pl/telefony-komorkowe/apple-iphone-15-256gb-midnight.bhtml',
        link: 'https://www.euro.com.pl/telefony-komorkowe/apple-iphone-15-pro-max-256gb-gold.bhtml',
        name: 'RTV Euro AGD' +
            ''
    },
    Play: {
        link: 'https://www.play.pl/dlafirm/produkty/apple/apple-iphone-15-pro-max-256-gb/?oid=4001297899&sku=TE-AP-15PM2-PL1-NT',
        name: 'Play'
    }
} satisfies Record<Store, Record<'link' | 'name', string>>

const getPage = async (url: string) => {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2' })
    return page
}

const checkMediaMarkt = async () => {
    const page = await getPage(Stores.MediaMarkt.link)
    return page.$$eval('.product-show-price.sidebox', async (priceBoxes) => {
        const priceBox = priceBoxes[0]
        if (!priceBox) return false
        return priceBox.querySelector('.item.availability')?.textContent.includes('Dostępny') ?? false
    })
}

const checkEuro = async () => {
    const page = await getPage(Stores.Euro.link)
    return page.$$eval("[icon='basket-add']", async (buttons) => {
        const button = buttons[0]
        if (!button) return false
        return button.textContent.includes('Dodaj do koszyka')
    })
}

const checkMediaExpert = async () => {
    const page = await getPage(Stores.MediaExpert.link)
    const isPreorder = await page.$$eval('.preorder', (preorder) => {
        return preorder != null
    })
    if (isPreorder) return false

    return page.$$eval(".add-to-cart", (buttons) => {
        const button = buttons[0]
        if (!button) return false
        return button.textContent.includes('Do koszyka')
    })
}

const checkPlay = async () => {
    const page = await getPage(Stores.Play.link)
    const isPreorder = await page.$$eval('.shipment-message', (preorder) => {
        return preorder != null
    })
    if (isPreorder) return false

    return page.$$eval(".offer-options__add-to-cart", (buttons) => {
        const button = buttons[0]
        if (!button) return false
        return button.textContent.includes('Do koszyka')
    })
}

const testStore = async <T extends Promise<any>>(store: Store, promise: T) => {
    console.log(`Testing ${store}.`)
    const available = await promise
    console.log(`Tested ${store}.`)
    return {
        store,
        available
    }
}

const settled = await Promise.allSettled([
    testStore('Play', checkPlay()),
    testStore('Euro', checkEuro()),
    testStore('MediaMarkt', checkMediaExpert()),
    testStore('MediaExpert', checkMediaMarkt())
])

const prisma = new PrismaClient()

const lastEntries = await prisma.record.findMany({
    where: {
        time: {
            lt: timestamp
        }
    },
    orderBy: [
        {
            time: 'desc',
        }
    ],
    take: 4,
})

const previouslyAvailable = lastEntries.reduce((prev, curr) => ({
    ...prev,
    [curr.store]: curr.available
}), {} as Record<Store, boolean>)

const availableOffers = {
    Play: false,
    Euro: false,
    MediaExpert: false,
    MediaMarkt: false,
} satisfies Record<Store, boolean>

for await (const item of settled) {
    if (item.status === 'rejected') {
        console.error(item.reason)
        continue
    }
    const result = item.value
    availableOffers[result.store] = result.available
    await prisma.record.create({
        data: {
            time: timestamp,
            store: result.store,
            available: result.available,
        }
    })
}

const htmlOffers = Store
    .filter(store => previouslyAvailable[store] !== availableOffers[store] && availableOffers[store])
    .map(store => `${Stores[store].name} <a href="${Stores[store].link}">LINK</a><br/>`)

if (htmlOffers.length === 0) {
    console.log('No new offers!')
    process.exit()
}

await fetch('https://api.pushover.net/1/messages.json',{
    method: 'POST',
    headers:{
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
        'token': 'ar5xb8ig48t21i5ne93s8sv8iei5p7',
        'user': 'utqr21ni7m26iv5qi1pbey35hasy6c',
        'message': `Nowe oferty na iPhonea!<br/><br/>${htmlOffers.join('')}`,
        'html': '1',
        'sound': 'updown',
    })
})

process.exit()
