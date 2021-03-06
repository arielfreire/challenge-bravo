const moment = require('moment');
const Configuration = require('../config/config');
const CurrencyDao = require('../dao/currency-dao');
const HistoricalExchangeRatesDao = require('../dao/historical-exchange-rates-dao');
const ExchangeRates = require('../models/exchange-rates');
const ExchangeResult = require('../models/dtos/exchange-result');
const ICoinService = require('./coin-service-interface');
const ErrorMessage = require('../models/dtos/error-msg');

class ExchangeRatesService {
    constructor(container) {
        this.coinService = container.get(ICoinService);
        this.historicalRatesDao = container.get(HistoricalExchangeRatesDao);
        this.currencyDao = container.get(CurrencyDao);
    }

    async getLatestExchangeRates() {
        const latestRates = await this.historicalRatesDao.getLatest();
        latestRates.referenceDate = moment(latestRates.referenceDate).format(
            Configuration.DEFAULT_DATE_FORMAT
        );
        return latestRates;
    }

    async exchangeFromTo(from, to, amount) {
        const latestRate = await this.historicalRatesDao.getLatest();
        const fromRate = latestRate[from];
        const toRate = latestRate[to];
        if (fromRate && toRate) {
            const result = new ExchangeResult();
            result.from = from;
            result.to = to;
            result.amount = amount;
            result.value = (toRate * amount) / fromRate;
            result.referenceDate = moment().format(Configuration.DEFAULT_DATE_FORMAT);
            return result;
        }
        const unavailableKey = !fromRate ? from : to;
        throw new ErrorMessage(400, `No support provided to given currency: ${unavailableKey}`);
    }

    async updateHistoricalExchangeRates() {
        const exchangeRates = await this.coinService.getAll();
        const availableCurrencies = await this.currencyDao.list();
        const referenceValue = exchangeRates.usd.value;
        const updatedExchangeRates = new ExchangeRates();
        availableCurrencies.forEach((currency) => {
            const currencyKey = currency.key;
            updatedExchangeRates[currencyKey] = exchangeRates[currencyKey].value / referenceValue;
        });
        await this.historicalRatesDao.insert(updatedExchangeRates);
        console.log('Successfully obtained updated exchange rates.');
        return updatedExchangeRates;
    }
}
module.exports = ExchangeRatesService;
