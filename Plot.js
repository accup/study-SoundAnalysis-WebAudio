"use strict";


/** [0.0, 1.0] または (0.0, 1.0] へ数値を変換する関数群 */
let AlphaConverters = {
	/** max(0.0, min(v, 1.0))
	 * @param {number} value
	 */
	linear(value) {
		return Math.max(0.0, Math.min(value, 1.0));
	},
	
	/** 1.0 - exp(-max(0.0, v))
	 * @param {number} value
	 */
	exponential(value) {
		return 1.0 - Math.exp(-Math.max(0.0, value));
	},
	
	/** 1.0 - 1.0 / (1.0 + max(0.0, v))
	 * @param {number} value
	 */
	inverse(value) {
		return 1.0 - 1.0 / (1.0 + Math.max(0.0, v))
	}
};



class GraphBase {
	/**
	 * @param {HTMLCanvasElement} htmlCanvasElement 
	 */
	constructor(htmlCanvasElement) {
		/** キャンバス要素 */
		this.canvas = htmlCanvasElement;
		/** キャンバスコンテキスト */
		this.context = this.canvas.getContext('2d');
	}
	
	/** 描画をクリアする */
	clear() {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}
}


/** 時間軸を持つグラフ */
class TimeDomainGraph extends GraphBase {
	/**
	 * @param {HTMLCanvasElement} htmlCanvasElement 
	 * @param {number} numFrames
	 */
	constructor(htmlCanvasElement, numFrames) {
		super(htmlCanvasElement);
		
		/** 表示されるフレーム数 */
		this.numFrames = numFrames;
		
		/** 次に描画するフレーム */
		this.currentFrame = 0;
	}
	
	changeNumFrames(numFrames) {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		
		this.numFrames = numFrames;
		this.currentFrame = 0;
	}
	
	proceedFrame() {
		this.currentFrame = (this.currentFrame + 1) % this.numFrames;
	}
}


/** 波形の描画 */
class WaveGraph extends GraphBase {
	/**
	 * @param {HTMLCanvasElement} htmlCanvasElement 
	 */
	constructor(htmlCanvasElement) {
		super(htmlCanvasElement);
		
		/** 描画色
		 * @type {string | CanvasGradient | CanvasPattern}
		 */
		this.fg_color = 'green';
		
		/** 描画の太さ
		 * @type {number}
		 */
		this.lineWidth = 1.0;
		
		/** 振幅軸に対するスケーリング */
		this.scale = 1.0;
	}
	
	/** 新しいフレームのデータを描画
	 * 
	 * @param {number[]} wave 任意長の1次元波形データ
	 */
	renderNextFrame(wave) {
		const cWidth = this.canvas.width;
		const cHeight = this.canvas.height;
		const lenWave = wave.length;
		
		// クリア
		this.context.clearRect(0, 0, cWidth, cHeight);
		
		// 描画スタイル
		this.context.strokeStyle = this.fg_color;
		this.context.lineWidth = this.lineWidth;
		this.context.globalAlpha = 1.0;
		
		// 直前の描画における最後のフレームのデータから線を繋ぐ
		this.context.beginPath();
		
		let firstValue = wave[0] * this.scale;
		let firstValuePos = cHeight * (0.5 + 0.5 * firstValue);
		this.context.moveTo(0, firstValuePos);
		for (let i=0; i<lenWave; ++i)
		{
			let framePos = i * cWidth / lenWave;
			
			// 出力値
			let value = wave[i] * this.scale;
			let valuePos = cHeight * (0.5 + 0.5 * value)
			
			// 線を繋ぐ
			this.context.lineTo(framePos, valuePos);
		}
		// 描画
		this.context.stroke();
	}
}


/** スペクトログラムの描画 */
class SpectrogramGraph extends TimeDomainGraph {
	/**
	 * @param {HTMLCanvasElement} htmlCanvasElement 
	 * @param {number} numFrames
	 */
	constructor(htmlCanvasElement, numFrames) {
		super(htmlCanvasElement, numFrames);
		
		/** 最も出力が大きい時の色
		 * @type {string | CanvasGradient | CanvasPattern}
		 */
		this.fg_color = 'green';
		
		/** 値域を [0, 1] に変換する関数 */
		this.alphaConverter = AlphaConverters.exponential;
	}
	
	/** 新しいフレームのデータを描画
	 * 
	 * @param {number[]} spectrum 
	 */
	renderNextFrame(spectrum) {
		const cWidth = this.canvas.width;
		const cHeight = this.canvas.height;
		const lenSpec = spectrum.length;
		/** 新しいフレームを描画する左端位置 */
		let left = Math.round(this.currentFrame * cWidth / this.numFrames);
		/** 新しいフレームを描画する右端位置 */
		let right = Math.round((this.currentFrame + 1) * cWidth / this.numFrames);
		
		// 新しいフレームを描画する場所をクリア
		this.context.clearRect(left, 0, right - left, cHeight);
		
		// 描画スタイル
		this.context.fillStyle = this.fg_color;
		
		for (let i=0; i<lenSpec; ++i)
		{
			let top = (lenSpec - i - 1) * cHeight / lenSpec;
			let bottom = (lenSpec - i) * cHeight / lenSpec;
			
			// 出力値を [0, 1] に変換してアルファ値として設定
			let value = spectrum[i];
			this.context.globalAlpha = this.alphaConverter(value);
			
			// データの描画
			this.context.fillRect(left, top, right - left, Math.max(1, bottom - top));
		}
		
		// 次に描画する位置に線を描画
		this.context.globalAlpha = 1.0;
		this.context.fillRect(right, 0, 1, cHeight);
		
		this.proceedFrame();
	}
}
