class App {
	constructor() {
		/** オーディオコンテキスト
		 * @type {AudioContext} */
		this.audioContext = new (AudioContext || webkitAudioContext)();
		/** アナライザ */
		this.analyser = this.audioContext.createAnalyser();
		
		/** ソース音源ノード
		 * @type {AudioNode} */
		this.sourceNode = null;
		
		/** 分析処理を実行中か */
		this.analyzing = false;
		
		/** 波形データ取得用バッファ
		 * @type {number[]} */
		this.waveBuffer = null;
		/** 波形表示キャンバス
		 * @type {HTMLCanvasElement} */
		this.cvsWave = document.getElementById('cvs-wave');
		/** 波形グラフ
		 * @type {WaveGraph} */
		this.waveGraph = new WaveGraph(this.cvsWave);
		
		/** FFTデータ取得用バッファ
		 * @type {number[]} */
		this.freqBuffer = null;
		/** FFT表示キャンバス
		 * @type {HTMLCanvasElement} */
		this.cvsFrequency = document.getElementById('cvs-frequency');
		/** FFTグラフ
		 * @type {SpectrogramGraph} */
		this.freqGraph = new SpectrogramGraph(this.cvsFrequency, 256);
		
		// 初期設定
		// FFTサイズ
		this.changeFFTSize(256);
		// グラフ描画用のコンバータの設定
		let customAlphaConverter = value => Math.max(0, value - this.analyser.minDecibels) / (this.analyser.maxDecibels - this.analyser.minDecibels);
		this.freqGraph.alphaConverter = customAlphaConverter;
	}
	
	changeFFTSize(fftSize) {
		this.analyser.fftSize = fftSize;
		
		this.waveBuffer = new Float32Array(this.analyser.fftSize);
		this.freqBuffer = new Float32Array(this.analyser.frequencyBinCount);
	}
	
	changeSourceNode(sourceNode) {
		if (this.sourceNode !== null) {
			this.sourceNode.disconnect();
		}
		this.sourceNode = sourceNode;
	}
	
	
	callback_renderAnalyzedData() {
		if (this.analyzing) {
			requestAnimationFrame(this.callback_renderAnalyzedData.bind(this));
		}
		
		this.analyser.getFloatTimeDomainData(this.waveBuffer);
		this.analyser.getFloatFrequencyData(this.freqBuffer);
		
		this.waveGraph.renderNextFrame(this.waveBuffer);
		this.freqGraph.renderNextFrame(this.freqBuffer);
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
}


/** @type {App} */
var app = null;

window.addEventListener('load', e => {
	app = new App();
	
	/** @type {HTMLButtonElement} */
	let btnStartStop = document.getElementById('button-start-stop');
	/** @type {HTMLInputElement} */
	let inputWaveScale = document.getElementById('input-wavescale');
	/** @type {HTMLSelectElement} */
	let selectFFTSize = document.getElementById('select-fftsize');
	
	// 波形データの表示スケール
	inputWaveScale.value = app.waveGraph.scale.toString(10);
	inputWaveScale.addEventListener('input', e => {
		let value = parseFloat(inputWaveScale.value);
		value = Math.max(1e-4, value);
		
		inputWaveScale.value = value.toString();
		app.waveGraph.scale = value;
	});
	
	// FFTサイズの設定
	const minLog2FFTSize = 5;
	const maxLog2FFTSize = 15;
	for (let i=minLog2FFTSize; i<=maxLog2FFTSize; ++i) {
		let fftSize = 2 ** i;
		
		let optionNode = document.createElement('option');
		optionNode.value = fftSize.toString();
		optionNode.textContent = fftSize.toString();
		selectFFTSize.appendChild(optionNode);
		
		if (app.analyser.fftSize == fftSize) {
			selectFFTSize.selectedIndex = i - minLog2FFTSize;
		}
	}
	
	selectFFTSize.addEventListener('input', e => {
		let fftSize = parseInt(selectFFTSize.value);
		
		if (fftSize != (fftSize & -fftSize)) {
			fftSize = 2 ** minLog2FFTSize;
		}
		selectFFTSize.value = fftSize.toString();
		
		app.changeFFTSize(fftSize);
	});
	
	// メディアデバイス
	navigator.mediaDevices.getUserMedia({
		audio: true,
		video: false
	}).then(audioStream => {
		const audioSourceNode = app.audioContext.createMediaStreamSource(audioStream);
		app.changeSourceNode(audioSourceNode);
		
		// 開始・停止ボタン
		btnStartStop.addEventListener('click', e => {
			if (!app.analyzing) {
				app.startAnalyzing();
				btnStartStop.textContent = 'Stop';
			} else {
				app.stopAnalyzing();
				btnStartStop.textContent = 'Start';
			}
		});
	});
});
