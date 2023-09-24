import {PrismaClient} from "@prisma/client";
import puppeteer from 'puppeteer-extra'

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const run = async () => {

    const timestamp = new Date()

    const browser = await puppeteer.launch({
        executablePath: process.argv[2] === 'pi' ? '/usr/bin/chromium-browser' : undefined,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
            name: 'RTV Euro AGD',
        },
        Play: {
            link: 'https://www.play.pl/dlafirm/produkty/apple/apple-iphone-15-pro-max-256-gb/?oid=4001297899&sku=TE-AP-15PM2-PL1-NT',
            name: 'Play',
        }
    } satisfies Record<Store, Record<'link' | 'name', string>>

    const getPage = async (url: string) => {
        const page = await browser.newPage()
        await page.setExtraHTTPHeaders({
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "cookie": "enp_wish_list_token=%5B%2214198e74e4e4c31b87fedb952a88c5c3%22%5D; SPARK_TEST=on; pos_select=200; __cflb=0H28v1cW9KaxJSr3bJb5zcrdYgoCE7iao574j4mCvn8; PHPSESSID=g9p6u44d1alk0a3i2obhlpvncl; SEARCH_STORED_KEY=iphone%2015%20pro%20max; __cf_bm=G8iLzp68HRf_SuM6D1AFfAbxvN19X9dsvIgC2gc6OiM-1695514835-0-AWrnomW6N24/uC3alWtQwFeLUr4XZPS+A++JX9lniSib4gKFUntwD4lwnBMB3BtN5ExK130tJRgu8BxbnKhz9jo=; cf_clearance=NAWXpjQiu0KCR2vMujyUbzU27oLDwZSbErAMrZEOQB8-1695514836-0-1-cdff026f.6e01088f.9afe5d8f-0.2.1695514836",
            "Referer": "https://mediamarkt.pl/telefony-i-smartfony/smartfony/wszystkie-smartfony.apple",
            "Referrer-Policy": "no-referrer-when-downgrade"
        })
        await page.setUserAgent('5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36');
        await page.setViewport({
            width: 1920 + Math.floor(Math.random() * 100),
            height: 3000 + Math.floor(Math.random() * 100),
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: false,
            isMobile: false,
        });
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.evaluateOnNewDocument(() => {
            // Pass webdriver check
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        await page.evaluateOnNewDocument(() => {
            // Pass chrome check
            (window as any).chrome = {
                runtime: {},
                // etc.
            };
        });

        await page.evaluateOnNewDocument(() => {
            // Overwrite the `plugins` property to use a custom getter.
            Object.defineProperty(navigator, 'plugins', {
                // This just needs to have `length > 0` for the current test,
                // but we could mock the plugins too if necessary.
                get: () => [1, 2, 3, 4, 5],
            });
        });

        await page.evaluateOnNewDocument(() => {
            // Overwrite the `languages` property to use a custom getter.
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        });
        const response = await page.goto(url, {
            waitUntil: 'networkidle2',
        })
        console.log(response.status())
        return page
    }

    const checkMediaMarkt = async () => {
        const page = await getPage(Stores.MediaMarkt.link)
        return page.$$eval('.product-show-price.sidebox', (priceBoxes) => {
            const priceBox = priceBoxes[0]
            if (!priceBox) return false
            return priceBox.querySelector('.item.availability')?.textContent.includes('Dostępny') ?? false
        })
    }

    const checkEuro = async () => {
        const page = await getPage(Stores.Euro.link)
        return page.$$eval("[icon='basket-add']", (buttons) => {
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

    const availableOffers: Record<Store, boolean> = {
        Play: false,
        Euro: false,
        MediaExpert: false,
        MediaMarkt: false,
    }

    const fns = {
        MediaMarkt: checkMediaMarkt,
        MediaExpert: checkMediaExpert,
        Play: checkPlay,
        Euro: checkEuro,
    }

    for await (const [store, fn] of Object.entries(fns)) {
        try {
            const result = await testStore(store as Store, fn())
            availableOffers[result.store] = result.available
            await prisma.record.create({
                data: {
                    time: timestamp,
                    store: result.store,
                    available: result.available,
                }
            })
        } catch (e) {
            console.error(e)
        }
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
}

run()
