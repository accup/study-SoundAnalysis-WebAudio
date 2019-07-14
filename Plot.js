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


let AlignmentAnchorSelector = {
	start:  (left, right) => left,
	end:    (left, right) => right,
	left:   (left, right) => left,
	right:  (left, right) => right,
	center: (left, right) => 0.5 * (left + right)
};

let BaselineAnchorSelector = {
	top:    (top, bottom) => top,
	hanging:(top, bottom) => 0.8 * top + 0.2 * bottom,
	middle: (top, bottom) => 0.5 * (top + bottom),
	alphabetic: (top, bottom) => 0.35 * top + 0.65 * bottom,
	ideographic:(top, bottom) => 0.2 * top + 0.8 * bottom,
	bottom: (top, bottom) => bottom
};


class ColorBar {
	/**
	 * 
	 * @param {number} value 
	 */
	static convertValueToHex(value) {
		value = Math.max(0, Math.min(Math.floor(value), 255));
		let hexString = value.toString(16).toUpperCase();
		
		if (hexString.length < 2) {
			return '0' + hexString;
		} else {
			return hexString;
		}
	}
	
	/**
	 * 
	 * @param {number} alpha 
	 */
	getRgbValue(alpha) {
		// alpha = Math.max(0.0, Math.min(alpha, 1.0));
		return {r: 0, g: 0, b: 0};
	}
	
	/** #RRGGBB 形式で出力する
	 * 
	 * @param {number} alpha [0.0, 1.0] のアルファ値
	 */
	hex(alpha) {
		let rgbValue = this.getRgbValue(alpha);
		return `#${ColorBar.convertValueToHex(rgbValue.r)}${ColorBar.convertValueToHex(rgbValue.g)}${ColorBar.convertValueToHex(rgbValue.b)}`;
	}
	
	/** rgb(R, G, B) 形式で出力する (0 <= R, G, B <= 255)
	 * 
	 * @param {number} alpha [0.0, 1.0] のアルファ値
	 */
	rgb(alpha) {
		let rgbValue = this.getRgbValue(alpha);
		return `rgb(${rgbValue.r}, ${rgbValue.g}, ${rgbValue.b})`;
	}
}

class SectionColorBar extends ColorBar {
	/**
	 * 
	 * @param {[number, number, number, number][]} sections [ステップ値, R, G, B] (0.0 ≦ ステップ値 ≦ 1.0, 0 ≦ R, G, B ≦ 255) の配列
	 */
	constructor(sections) {
		super();
		
		if (sections.length < 2)
			throw new Error('カラーセクションを2つ以上用意してください。');
		
		this.sections = sections
			.map(section => [
				section[0],
				Math.max(0, Math.min(section[1], 255)),
				Math.max(0, Math.min(section[2], 255)),
				Math.max(0, Math.min(section[3], 255))])
			.sort(section => section[0]);
		
		let minStep = this.sections[0][0];
		let maxStep = this.sections[this.sections.length - 1][0];
		
		this.sections[0][0] = 0.0;
		this.sections[this.sections.length - 1][0] = 1.0;
		
		for (let i=1, n=this.sections.length-1; i<n; ++i) {
			let normalizedStep = (this.sections[i][0] - minStep) / (maxStep - minStep);
			this.sections[i][0] = Math.max(0.0, Math.min(normalizedStep, 1.0));
		}
	}
	
	
	/**
	 * 
	 * @param {number} alpha [0.0, 1.0] のアルファ値
	 */
	getLowerIndex(alpha) {
		let le = 0;
		let gt = this.sections.length;
		
		while (1 < gt - le) {
			// (le + gt) / 2 の整数安定版
			let mid = (le + gt) >> 1;
			
			if (this.sections[mid][0] <= alpha) {
				le = mid;
			} else {
				gt = mid;
			}
		}
		
		return le;
	}
	
	/**
	 * 
	 * @param {number} alpha 
	 */
	getRgbValue(alpha) {
		alpha = Math.max(0.0, Math.min(alpha, 1.0));
		let lowerIndex = this.getLowerIndex(alpha);
		
		if (lowerIndex == this.sections.length - 1) {
			return {
				r: this.sections[lowerIndex][1],
				g: this.sections[lowerIndex][2],
				b: this.sections[lowerIndex][3]
			};
		}
		
		let lowerSection = this.sections[lowerIndex];
		let upperSection = this.sections[lowerIndex + 1];
		
		let ratio = (alpha - lowerSection[0]) / (upperSection[0] - lowerSection[0]);
		let r = (1.0 - ratio) * lowerSection[1] + ratio * upperSection[1];
		let g = (1.0 - ratio) * lowerSection[2] + ratio * upperSection[2];
		let b = (1.0 - ratio) * lowerSection[3] + ratio * upperSection[3];
		
		return {
			r: Math.max(0, Math.min(Math.round(r), 255)),
			g: Math.max(0, Math.min(Math.round(g), 255)),
			b: Math.max(0, Math.min(Math.round(b), 255))
		}
	}
}


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
		
		/** 描画色（カラーバー）
		 * @type {ColorBar}
		 */
		this.fg_color = new SectionColorBar([
			[0.0, 0,   0, 0],
			[1.0, 0, 255, 0]
		]);
		
		/** 値域を [0, 1] に変換する関数 */
		this.alphaConverter = AlphaConverters.linear;
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
		this.context.globalAlpha = 1.0;
		
		for (let i=0; i<lenSpec; ++i)
		{
			let top = (lenSpec - i - 1) * cHeight / lenSpec;
			let bottom = (lenSpec - i) * cHeight / lenSpec;
			
			// 出力値を [0, 1] に変換して描画色を設定
			let value = spectrum[i];
			this.context.fillStyle = this.fg_color.hex(this.alphaConverter(value));
			
			// データの描画
			this.context.fillRect(left, top, right - left, Math.max(1, bottom - top));
		}
		
		// 次に描画する位置に線を描画
		this.context.globalAlpha = 1.0;
		this.context.fillStyle = this.fg_color.hex(1.0);
		this.context.fillRect(right, 0, 1, cHeight);
		
		this.proceedFrame();
	}
}


class TickGraph extends GraphBase {
	/**
	 * @param {HTMLCanvasElement} htmlCanvasElement 
	 */
	constructor(htmlCanvasElement) {
		super(htmlCanvasElement);
		
		/** 文字色
		 * @type {string | CanvasGradient | CanvasPattern}
		 */
		this.fg_color = 'black';
		
		/** フォント
		 * @type {string}
		 */
		this.font = '16px sans-serif';
		
		/** 水平の揃え方
		 * @type {CanvasTextAlign}
		 */
		this.alignment = 'right'
		
		/** 垂直の揃え方
		 * @type {CanvasTextBaseline}
		 */
		this.baseline = 'middle';
		
		/** 最後の描画設定を保持 */
		this.indices = null;
		this.labels = null;
		this.numDivision = null;
	}
	
	changeFont(font) {
		this.font = font;
		this.renderTicks(this.indices, this.labels, this.numDivision);
	}
	
	/** 縦にラベルを描画する
	 * @param {number[]} indices 上から0から始めて何番目かを並べた配列
	 * @param {string[]} labels ラベルの配列
	 * @param {number} numDivision 軸の分割数
	 */
	renderTicks(indices, labels, numDivision) {
		this.indices = indices;
		this.labels = labels;
		this.numDivision = numDivision;
		
		const cWidth = this.canvas.width;
		const cHeight = this.canvas.height;
		
		const lenIndices = indices.length;
		
		// クリア
		this.context.clearRect(0, 0, cWidth, cHeight);
		
		// 描画スタイル
		this.context.fillStyle = this.fg_color;
		this.context.globalAlpha = 1.0;
		this.context.font = this.font;
		this.context.textAlign = this.alignment;
		this.context.textBaseline = this.baseline;
		
		const alignAnchorSelector = AlignmentAnchorSelector[this.alignment];
		const baseAnchorSelector = BaselineAnchorSelector[this.baseline];
		
		let alignAnchor = alignAnchorSelector(0, cWidth);
		
		for (let i=0; i<lenIndices; ++i) {
			let index = indices[i];
			let top = index * cHeight / numDivision;
			let bottom = (index + 1) * cHeight / numDivision;
			
			this.context.fillText(labels[i], alignAnchor, baseAnchorSelector(top, bottom));
		}
	}
}
