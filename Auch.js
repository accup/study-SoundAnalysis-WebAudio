function calcPitch(frequency, baseFrequency) {
	return Math.log2(frequency / baseFrequency);
}

function calcFrequency(pitch, baseFrequency) {
	return (2 ** pitch) * baseFrequency;
}


/** 周波数ビンを回して、各ビンの寄与率はそのままで加算する
 * @param {number[]} chroma クロマベクトル格納用配列
 * @param {number[]} spectrum FFT後のスペクトラム
 * @param {number} sampleRate サンプリング周波数
 * @param {number} baseFrequency クロマベクトルの0番目に属する基準周波数
 * @param {number} numChroma クロマベクトルの長さ
 */
function computeChroma1(chroma, spectrum, sampleRate, baseFrequency) {
	const numChroma = chroma.length;
	chroma.fill(0.0);
	
	const lenSpectrum = spectrum.length;
	
	let lowFreq = 0 * sampleRate / (2 * lenSpectrum);
	let midFreq = 1 * sampleRate / (2 * lenSpectrum);
	let midPitch = Math.round(numChroma * calcPitch(midFreq, baseFrequency));
	for (let i=1; i<lenSpectrum; ++i) {
		let highFreq = (i + 1) * sampleRate / (2 * lenSpectrum);
		let highPitch = Math.round(numChroma * calcPitch(highFreq, baseFrequency));
		
		let index = (midPitch % numChroma);
		if (index < 0) index += numChroma;
				
		// デシベルを基準からのパワースペクトルに変換
		chroma[index] += 10 ** (spectrum[i] / 10);
		
		// 更新
		lowFreq = midFreq;
		midFreq = highFreq;
		midPitch = highPitch;
	}
}


/** 周波数ビンを回して、対数周波数ビンの幅を考慮して加算する
 * @param {number[]} chroma クロマベクトル格納用配列
 * @param {number[]} spectrum FFT後のスペクトラム
 * @param {number} sampleRate サンプリング周波数
 * @param {number} baseFrequency クロマベクトルの0番目に属する基準周波数
 * @param {number} numChroma クロマベクトルの長さ
 */
function computeChroma2(chroma, spectrum, sampleRate, baseFrequency) {
	const numChroma = chroma.length;
	chroma.fill(0.0);
	
	const lenSpectrum = spectrum.length;
	
	let lowFreq = 0 * sampleRate / (2 * lenSpectrum);
	let lowPitch = Math.round(numChroma * calcFrequency(lowFreq, baseFrequency));
	let midFreq = 1 * sampleRate / (2 * lenSpectrum);
	let midPitch = Math.round(numChroma * calcPitch(midFreq, baseFrequency));
	for (let i=1; i<lenSpectrum; ++i) {
		let highFreq = (i + 1) * sampleRate / (2 * lenSpectrum);
		let highPitch = Math.round(numChroma * calcPitch(highFreq, baseFrequency));
		
		let start = 0.5 * (lowPitch + midPitch);
		let stop = 0.5 * (midPitch + highPitch);
		
		let index = (midPitch % numChroma);
		if (index < 0) index += numChroma;
				
		chroma[index] += (stop - start) * (10 ** (spectrum[i] / 10));
		
		// 更新
		lowFreq = midFreq;
		midFreq = highFreq;
		lowPitch = midPitch;
		midPitch = highPitch;
	}
}

/** ピッチを回して加算するクロマベクトル
 * @param {number[]} chroma クロマベクトル格納用配列
 * @param {number[]} spectrum FFT後のスペクトラム
 * @param {number} sampleRate サンプリング周波数
 * @param {number} baseFrequency クロマベクトルの0番目に属する基準周波数
 * @param {number} numChroma クロマベクトルの長さ
 */
function computeChroma3(chroma, spectrum, sampleRate, baseFrequency) {
	const numChroma = chroma.length;
	chroma.fill(0.0);
	
	const lenSpectrum = spectrum.length;
	const maxPitch = Math.round(numChroma * calcPitch(sampleRate / 2, baseFrequency));
	const minPitch = Math.round(numChroma * calcPitch(1, baseFrequency));
	
	for (let pitch=minPitch; pitch<maxPitch; ++pitch) {
		let chromaIndex = pitch % numChroma;
		if (chromaIndex < 0) chromaIndex += numChroma;
		
		let freq = calcFrequency(pitch / numChroma, baseFrequency);
		let specIndex = Math.round(freq * (2 * lenSpectrum) / sampleRate);
		if (specIndex < 1) continue;
		if (lenSpectrum < specIndex) break;
		
		chroma[chromaIndex] += (10 ** (spectrum[specIndex] / 10));
	}
}
