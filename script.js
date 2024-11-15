const API_KEY = 'nc3cvP0d3LZzL9AIIgQQsjU6MKN8g5oanFkiAo4BdykbaOlce3HsTbWB3mPCoL8z';
const BASE_URL = 'https://api.binance.com/api/v3';

class CryptoAnalyzer {
    constructor() {
        this.timeFrame = document.getElementById('timeFrame');
        this.customTime = document.getElementById('customTime');
        this.lowPriceCryptoList = document.getElementById('lowPriceCryptoList');
        this.highPriceCryptoList = document.getElementById('highPriceCryptoList');
        this.refreshBtn = document.getElementById('refresh');
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.updateAnalysis();
        setInterval(() => this.updateAnalysis(), 60000);
    }

    setupEventListeners() {
        this.refreshBtn.addEventListener('click', () => {
            this.refreshBtn.classList.add('loading');
            this.updateAnalysis().finally(() => {
                this.refreshBtn.classList.remove('loading');
            });
        });

        this.timeFrame.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                this.customTime.classList.add('active');
            } else {
                this.customTime.classList.remove('active');
                this.updateAnalysis();
            }
        });

        this.customTime.querySelector('input').addEventListener('change', () => {
            this.updateAnalysis();
        });
    }

    getTimeInterval() {
        if (this.timeFrame.value === 'custom') {
            const minutes = parseInt(this.customTime.querySelector('input').value) || 5;
            return `${minutes}m`;
        }
        return `${this.timeFrame.value}m`;
    }

    async fetchTradingPairs() {
        try {
            const response = await fetch(`${BASE_URL}/exchangeInfo`);
            const data = await response.json();
            return data.symbols
                .filter(symbol => symbol.quoteAsset === 'USDT' && symbol.status === 'TRADING')
                .map(symbol => symbol.symbol);
        } catch (error) {
            console.error('خطأ في جلب أزواج التداول:', error);
            return [];
        }
    }

    async fetchPrice(symbol) {
        try {
            const response = await fetch(`${BASE_URL}/ticker/24hr?symbol=${symbol}`);
            const data = await response.json();
            return {
                price: parseFloat(data.lastPrice),
                priceChange: parseFloat(data.priceChangePercent)
            };
        } catch (error) {
            console.error(`خطأ في جلب سعر ${symbol}:`, error);
            return null;
        }
    }

    async fetchKlines(symbol, interval, limit) {
        try {
            const response = await fetch(
                `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
            );
            return await response.json();
        } catch (error) {
            console.error(`خطأ في جلب البيانات لـ ${symbol}:`, error);
            return [];
        }
    }

    calculateTargets(currentPrice, volatility) {
        const riskFactor = volatility * 0.01;
        return {
            target1: currentPrice * (1 + riskFactor),
            target2: currentPrice * (1 + riskFactor * 2),
            target3: currentPrice * (1 + riskFactor * 3),
            stopLoss: currentPrice * (1 - riskFactor * 0.75)
        };
    }

    analyzeTrend(klines) {
        const closes = klines.map(k => parseFloat(k[4]));
        const volumes = klines.map(k => parseFloat(k[5]));
        
        // حساب المتوسطات المتحركة
        const ema9 = this.calculateEMA(closes, 9);
        const ema21 = this.calculateEMA(closes, 21);
        
        // حساب مؤشر MACD
        const macd = this.calculateMACD(closes);
        
        // حساب مؤشر RSI
        const rsi = this.calculateRSI(closes);
        
        // تحليل حجم التداول
        const volumeTrend = this.analyzeVolume(volumes);
        
        // حساب نسبة الثقة
        let confidence = 0;
        
        // تحليل اتجاه السعر
        if (closes[closes.length - 1] > ema9[ema9.length - 1]) confidence += 20;
        if (ema9[ema9.length - 1] > ema21[ema21.length - 1]) confidence += 20;
        
        // تحليل MACD
        if (macd.histogram > 0) confidence += 20;
        if (macd.macdLine > macd.signalLine) confidence += 10;
        
        // تحليل RSI
        if (rsi > 50 && rsi < 70) confidence += 20;
        
        // تحليل حجم التداول
        if (volumeTrend > 1) confidence += 10;
        
        return {
            confidence,
            volatility: Math.max(10, Math.min(30, confidence / 2))
        };
    }

    calculateEMA(prices, period) {
        const multiplier = 2 / (period + 1);
        let ema = [prices[0]];
        
        for (let i = 1; i < prices.length; i++) {
            ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
        }
        
        return ema;
    }

    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
        const signalLine = this.calculateEMA([macdLine], 9)[0];
        
        return {
            macdLine,
            signalLine,
            histogram: macdLine - signalLine
        };
    }

    calculateRSI(prices) {
        const period = 14;
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i < prices.length; i++) {
            const difference = prices[i] - prices[i - 1];
            if (difference >= 0) {
                gains += difference;
            } else {
                losses -= difference;
            }
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        
        return 100 - (100 / (1 + rs));
    }

    analyzeVolume(volumes) {
        const recentVolumes = volumes.slice(-5);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const recentAvgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        
        return recentAvgVolume / avgVolume;
    }

    getConfidenceClass(confidence) {
        if (confidence >= 80) return 'high-confidence';
        if (confidence >= 50) return 'medium-confidence';
        return 'low-confidence';
    }

    createCryptoCard(symbol, currentPrice, priceData, analysis) {
        const confidenceClass = this.getConfidenceClass(analysis.confidence);
        const targets = this.calculateTargets(currentPrice, analysis.volatility);
        const priceChangeClass = priceData.priceChange >= 0 ? 'price-up' : 'price-down';
        const priceChangeIcon = priceData.priceChange >= 0 ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow';
        
        return `
            <div class="crypto-card">
                <div class="crypto-header">
                    <div>
                        <span class="crypto-symbol">
                            <i class="bi bi-currency-exchange"></i>
                            ${symbol}
                        </span>
                        <div class="crypto-price">
                            ${currentPrice.toFixed(8)} USDT
                            <span class="price-change ${priceChangeClass}">
                                <i class="bi ${priceChangeIcon}"></i>
                                ${Math.abs(priceData.priceChange).toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <span class="confidence ${confidenceClass}">
                        <i class="bi bi-lightning-charge"></i>
                        ${analysis.confidence}%
                    </span>
                </div>
                <div class="targets">
                    <h4>
                        <i class="bi bi-bullseye"></i>
                        التوقعات والأهداف
                    </h4>
                    <div class="target-item">
                        <span class="target-label">
                            <i class="bi bi-1-circle"></i>
                            الهدف الأول
                        </span>
                        <span>${targets.target1.toFixed(8)}</span>
                    </div>
                    <div class="target-item">
                        <span class="target-label">
                            <i class="bi bi-2-circle"></i>
                            الهدف الثاني
                        </span>
                        <span>${targets.target2.toFixed(8)}</span>
                    </div>
                    <div class="target-item">
                        <span class="target-label">
                            <i class="bi bi-3-circle"></i>
                            الهدف الثالث
                        </span>
                        <span>${targets.target3.toFixed(8)}</span>
                    </div>
                    <div class="target-item">
                        <span class="target-label">
                            <i class="bi bi-shield-fill-exclamation"></i>
                            وقف الخسارة
                        </span>
                        <span>${targets.stopLoss.toFixed(8)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    async updateAnalysis() {
        this.lowPriceCryptoList.innerHTML = '<div class="loading">جاري التحليل... ⏳</div>';
        this.highPriceCryptoList.innerHTML = '<div class="loading">جاري التحليل... ⏳</div>';
        
        try {
            const pairs = await this.fetchTradingPairs();
            const interval = this.getTimeInterval();
            
            const analyses = await Promise.all(
                pairs.slice(0, 50).map(async (symbol) => {
                    const [klines, priceData] = await Promise.all([
                        this.fetchKlines(symbol, interval, 100),
                        this.fetchPrice(symbol)
                    ]);
                    
                    if (klines.length === 0 || !priceData) return null;
                    
                    const currentPrice = parseFloat(klines[klines.length - 1][4]);
                    const analysis = this.analyzeTrend(klines);
                    
                    return {
                        symbol,
                        currentPrice,
                        priceData,
                        analysis,
                        confidence: analysis.confidence
                    };
                })
            );

            const validAnalyses = analyses
                .filter(item => item !== null)
                .sort((a, b) => b.analysis.confidence - a.analysis.confidence);

            const lowPriceAnalyses = validAnalyses.filter(item => item.currentPrice < 1);
            const highPriceAnalyses = validAnalyses.filter(item => item.currentPrice >= 1);

            this.lowPriceCryptoList.innerHTML = lowPriceAnalyses
                .map(item => this.createCryptoCard(
                    item.symbol,
                    item.currentPrice,
                    item.priceData,
                    item.analysis
                ))
                .join('');

            this.highPriceCryptoList.innerHTML = highPriceAnalyses
                .map(item => this.createCryptoCard(
                    item.symbol,
                    item.currentPrice,
                    item.priceData,
                    item.analysis
                ))
                .join('');

        } catch (error) {
            console.error('خطأ في تحديث التحليل:', error);
            const errorMessage = '<div class="error">حدث خطأ في تحليل البيانات</div>';
            this.lowPriceCryptoList.innerHTML = errorMessage;
            this.highPriceCryptoList.innerHTML = errorMessage;
        }
    }
}

// تهيئة المحلل
new CryptoAnalyzer();