const puppeteer = require('puppeteer')
const lighthouse = require('lighthouse')
const validUrl = require('valid-url')
const { GoogleSpreadsheet } = require('google-spreadsheet')
const { URL } = require('url')

require('dotenv').config()

;(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
  })

  const doc = new GoogleSpreadsheet(process.env.DOC_ID)
  await doc.useServiceAccountAuth(require('./config/creds.json'))
  await doc.getInfo()

  const sheet = doc.sheetsById[process.env.SHEET_ID]
  const rows = await sheet.getRows()

  let jobs = []

  rows.forEach(async row => {
    const url = row['Company Website']

    if (validUrl.isUri(url) && (!row['Performance'] || row['Performance'] === '-1')) {
      jobs.push({
        url: url,
        row: row
      })
    }
  })

  while (jobs.length > 0) {
    const { url, row } = jobs.pop()

    console.log('[i] Scanning: ' + url)

    try {
      const { lhr } = await lighthouse(url, {
        port: (new URL(browser.wsEndpoint())).port,
        output: 'json',
        logLevel: 'error'
      })

      row['Performance'] = lhr.categories.performance.score * 100
      row['Accessibility'] = lhr.categories.accessibility.score * 100
      row['Best Practices'] = lhr.categories['best-practices'].score * 100
      row['SEO'] = lhr.categories.seo.score * 100
      console.log('[i] Scan completed!')
    } catch (err) {
      console.log('[i] Error occurred: ' + err)
      row['Performance'] = -1
      row['Accessibility'] = -1
      row['Best Practices'] = -1
      row['SEO'] = -1
    }

    row.save()
  }

  console.log('[i] All done!')
  await browser.close()
})()