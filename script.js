class App {
	constructor() {
		/** オーディオコンテキスト
		 * @type {AudioContext} */
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
		/** サンプリング周波数（多分プロパティ未対応のブラウザは 44100 Hz 固定） */
		this.sampleRate = this.audioContext.sampleRate || 44100;
		/** アナライザ */
		this.analyser = this.audioContext.createAnalyser();
		/** AnalyserNode.getFloatTimeDomainData が iOS Safari で動かないので苦肉の策 */
		this.getFloatTimeDomainData = (
			'getFloatTimeDomainData' in this.analyser
			? floatBuffer => this.analyser.getFloatTimeDomainData(floatBuffer)
			: floatBuffer => {
				this.analyser.getByteTimeDomainData(this.waveByteBuffer);
				for (let i=0, n=floatBuffer.length; i<n; ++i) {
					floatBuffer[i] = this.waveByteBuffer[i] / 128.0 - 1.0;
				}
			});
		/** 波形データ取得用サブバッファ
		 * @type {Uint8Array} */
		this.waveByteBuffer = null;
		
		/** 波形データ用バッファ
		 * @type {Float32Array} */
		this.waveBuffer = null;
		
		/** スペクトラム用バッファ
		 * @type {Float32Array} */
		this.spectrumBuffer = null;
		
		/** 波形拡大率 */
		this.loudness = 1.0;
		
		/** 解析コールバック
		 * @type {AnalysisCallback[]}
		 */
		this.analysisCallbacks = [];
				
		
		/** ソース音源ノード
		 * @type {AudioNode} */
		this.sourceNode = null;
		
		/** 分析処理を実行中か */
		this.analyzing = false;
		
		// 初期設定
		this.changeFFTSize(2048);
	}
	
	changeFFTSize(fftSize) {
		this.analyser.fftSize = fftSize;
		
		this.waveBuffer = new Float32Array(this.analyser.fftSize);
		this.waveByteBuffer = new Uint8Array(this.analyser.fftSize);
		this.spectrumBuffer = new Float32Array(this.analyser.frequencyBinCount);
	}
	
	changeLoudness(loudness) {
		this.loudness = loudness;
	}
	
	changeSourceNode(sourceNode) {
		if (this.sourceNode !== null) {
			this.sourceNode.disconnect();
		}
		this.sourceNode = sourceNode;
	}
	
	
	startAnalyzing() {
		if (this.analyzing) return;
		
		if (this.sourceNode === null) return;
		
		this.audioContext.resume();
		this.analyzing = true;
		
		this.sourceNode.connect(this.analyser);
		requestAnimationFrame(this.callback_renderAnalyzedData.bind(this));
	}
	
	stopAnalyzing(stoppedCallback) {
		if (!this.analyzing) return;
		
		this.sourceNode.disconnect();
		this.analyzing = false;
	}
	
	
	callback_renderAnalyzedData() {
		if (this.analyzing) {
			requestAnimationFrame(this.callback_renderAnalyzedData.bind(this));
		}
		
		this.getFloatTimeDomainData(this.waveBuffer);
		// loudness に従って拡大
		for (let i=0, n=this.waveBuffer.length; i<n; ++i) {
			this.waveBuffer[i] *= this.loudness;
		}
		this.analyser.getFloatFrequencyData(this.spectrumBuffer);
		// loudness に従ってデシベルの下駄をはかせる
		const decibelBias = 10 * Math.log10(this.loudness);
		for (let i=0, n=this.spectrumBuffer.length; i<n; ++i) {
			this.spectrumBuffer[i] += decibelBias;
		}
		
		for (let i=0, n=this.analysisCallbacks.length; i<n; ++i) {
			this.analysisCallbacks[i].renderAnalyzedData();
		}
	}
}


/** @type {App} */
var app = null;

window.addEventListener('load', e => {
	app = new App();
	
	// 分析処理群
	let waveAnalysis = new class {
		constructor() {
			/** 波形グラフ */
			this.waveGraph = new WaveGraph(
				document.getElementById('cvs-wave'));
			this.waveTick = new TickGraph(
				document.getElementById('cvs-wave-tick'));
				
			this.changeWaveScale(1.0);
		}
		
		changeWaveScale(waveScale) {
			waveScale = Math.max(1e-4, waveScale);
			
			// スケールの変更
			this.waveGraph.scale = waveScale;
			
			// 目盛りの描画
			this.waveTick.renderTicks(
				[0, 3, 6],
				[(1.0 / waveScale).toPrecision(2), 0.0, (-1.0 / waveScale).toPrecision(2)],
				7);
		}
		
		renderAnalyzedData() {
			this.waveGraph.renderNextFrame(app.waveBuffer);
		}
	}();
	app.analysisCallbacks.push(waveAnalysis);
	
	let spectrumAnalysis = new class {
		constructor() {
			/** FFTグラフ */
			this.freqGraph = new SpectrogramGraph(
				document.getElementById('cvs-frequency'), 256);
			this.freqTick = new TickGraph(
				document.getElementById('cvs-frequency-tick'));
			
			// グラフ描画用のコンバータの設定
			let customAlphaConverter = value => Math.max(0, value - app.analyser.minDecibels) / (app.analyser.maxDecibels - app.analyser.minDecibels);
			this.freqGraph.alphaConverter = customAlphaConverter;
			
			this.changeFFTSize(256);
		}
		
		changeFFTSize(fftSize) {
			const numDivision = 32;
			let indices = [];
			let labels = [];
			
			for (let i=0; i<numDivision; i+=4) {
				indices.push(numDivision - i - 1);
				labels.push((i * app.sampleRate / (2 * numDivision)).toString());
			}
			this.freqTick.renderTicks(indices, labels, numDivision);
		}
		
		renderAnalyzedData() {
			this.freqGraph.renderNextFrame(app.spectrumBuffer);
		}
	}();
	app.analysisCallbacks.push(spectrumAnalysis);	
	
	class ChromaAnalysis {
		constructor(computeChroma, cvsGraphId, cvsTickId) {
			/** @type {Float32Array} */
			this.chromaBuffer = null;
			this.invMaxChroma = 0.0;

			this.computeChroma = computeChroma;
			
			this.chromaGraph = new SpectrogramGraph(
				document.getElementById(cvsGraphId), 256);
			this.chromaTick = new TickGraph(
				document.getElementById(cvsTickId));
			
			const numDivision = 12;
			const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
			const labels = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
			this.chromaTick.renderTicks(indices, labels, numDivision);
			
			this.changeNumChroma(12);
		}
		
		changeNumChroma(numChroma) {
			numChroma = Math.max(1, Math.floor(numChroma));
			
			this.chromaBuffer = new Float32Array(numChroma);
		}
		
		renderAnalyzedData() {
			this.computeChroma(this.chromaBuffer, app.spectrumBuffer, app.sampleRate, 440 * (2 ** (3 / 12)))
			let maxChroma = this.chromaBuffer.reduce((acc, val) => Math.max(acc, val));
			this.invMaxChroma = maxChroma < 1e-7 ? 0.0 : (1.0 / maxChroma)

			this.chromaGraph.renderNextFrame(this.chromaBuffer);
		}
	}
	
	app.analysisCallbacks.push(new ChromaAnalysis(
		computeChroma1, 'cvs-chroma1', 'cvs-chroma1-tick'));
	app.analysisCallbacks.push(new ChromaAnalysis(
		computeChroma2, 'cvs-chroma2', 'cvs-chroma2-tick'));
	app.analysisCallbacks.push(new ChromaAnalysis(
		computeChroma3, 'cvs-chroma3', 'cvs-chroma3-tick'));	
	
	// カラーマップとフォントの設定
	const colorBar = new SectionColorBar([
		[ 0.0,   0,   0,   0],
		[ 1.0,   0, 255,   0]
	]);
	const font = '16px Ubuntu, sans-serif';
	spectrumAnalysis.freqGraph.fg_color = colorBar;
	waveAnalysis.waveTick.changeFont(font);
	spectrumAnalysis.freqTick.changeFont(font);
	
	// Chroma Analyses
	let chromaNames = ['chroma1', 'chroma2', 'chroma3']
	for (let i=0; i<app.analysisCallbacks.length; ++i) {
		let analysis = app.analysisCallbacks[i];
		if (analysis instanceof ChromaAnalysis) {
			let name = chromaNames.shift();

			analysis.chromaGraph.fg_color = colorBar;
			analysis.chromaTick.changeFont(font);
			
			const vmNormalizationEnable = new Vue({
				el: '#button-' + name + '-normalizationenable',
				data: {
					analysis: analysis,
					enabled: false,
					actionMessage: 'Disabled'
				},
				methods: {
					action() {
						this.enabled = !this.enabled;
						if (this.enabled) {
							this.actionMessage = 'Enabled';
							this.analysis.chromaGraph.alphaConverter = chroma => AlphaConverters.linear(chroma * this.analysis.invMaxChroma);
						} else {
							this.actionMessage = 'Disabled';
							this.analysis.chromaGraph.alphaConverter = AlphaConverters.linear;
						}
					}
				}
			})
		}
	}
	
	
	// 時間軸表示フレーム数
	const vmNumFrames = new Vue({
		el: '#input-numframes',
		data: {
			numFrames: spectrumAnalysis.freqGraph.numFrames
		},
		watch: {
			numFrames() {
				let numFrames = Math.max(10, Math.min(Math.round(this.numFrames), 10000));
				this.numFrames = numFrames;
				
				spectrumAnalysis.freqGraph.changeNumFrames(numFrames);
				
				// Chroma Analyses
				for (let i=0; i<app.analysisCallbacks.length; ++i) {
					let analysis = app.analysisCallbacks[i];
					if (analysis instanceof ChromaAnalysis) {
						analysis.chromaGraph.changeNumFrames(numFrames);
					}
				}
			}
		}
	});
	
	// サンプリング周波数
	const vmSampleRate = new Vue({
		el: '#output-samplerate',
		data: {
			sampleRate: app.sampleRate
		}
	});
	
	// 出力スケーリング
	const vmLoudness = new Vue({
		el: '#input-loudness',
		data: {
			loudness: 1.0
		},
		watch: {
			loudness() {
				let loudness = Math.max(0.0001, this.loudness);
				this.loudness = loudness;
				app.changeLoudness(loudness);
			}
		}
	});
	
	
	// 波形データの表示スケール
	const vmWaveScale = new Vue({
		el: '#input-wavescale',
		data: {
			waveScale: waveAnalysis.waveGraph.scale
		},
		watch: {
			waveScale() {
				let value = parseFloat(this.waveScale);
				
				this.waveScale = value;
				waveAnalysis.changeWaveScale(value);
			}
		}
	});
		
	// FFTサイズの設定
	const vmFFTSize = new Vue({
		el: '#select-fftsize',
		data: {
			fftSize: app.analyser.fftSize,
			fftSizes: []
		},
		watch: {
			fftSize() {
				let fftSize = parseInt(this.fftSize);
		
				if (fftSize != (fftSize & -fftSize)) {
					fftSize = 2 ** minLog2FFTSize;
				}
				this.fftSize = fftSize.toString();
				
				app.changeFFTSize(fftSize);
				spectrumAnalysis.changeFFTSize(fftSize);
			}
		}
	});
	const minLog2FFTSize = 5;
	const maxLog2FFTSize = 15;
	for (let i=minLog2FFTSize; i<=maxLog2FFTSize; ++i) {
		vmFFTSize.fftSizes.push(fftSize = 2 ** i);
	}
	
	
	// メディアデバイス
	(navigator.mediaDevices || navigator).getUserMedia({
		audio: true,
		video: false
	}).then(audioStream => {
		const audioSourceNode = app.audioContext.createMediaStreamSource(audioStream);
		app.changeSourceNode(audioSourceNode);
		
		// 開始・停止ボタン
		const vmToggleAnalysis = new Vue({
			el: '#button-start-stop',
			data: {
				actionMessage: 'Start'
			},
			methods: {
				toggleAnalysis() {
					if (!app.analyzing) {
						app.startAnalyzing();
						this.actionMessage = 'Analyzing...';
					} else {
						app.stopAnalyzing();
						this.actionMessage = 'Start';
					}
				}
			}
		});
	});
});
