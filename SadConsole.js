{
	const ua = navigator.userAgent;
	const isIOS = ua.indexOf("iPhone") >= 0
		|| ua.indexOf("iPad") >= 0
		|| ua.indexOf("iPod") >= 0;
	
	if (isIOS) {
		/** iOS */
		
		function SadConsoleBase () {}

		SadConsoleBase.prototype = window.console;


		class SadConsole extends SadConsoleBase {
			/**
			 * @param {Console} prevConsole 
			 */
			constructor(prevConsole) {
				super();
				
				this.console = prevConsole;
				
				/** @type {[string, string][]} */
				this.queue = [];
				
				/** @type {HTMLElement} */
				this.consoleElement = null;
			}
			
			flush() {
				if (this.consoleElement === null) return;
				
				while (0 < this.queue.length) {
					let item = this.queue.shift();
					
					let div = document.createElement('div');
					{
						div.classList.add('alert', item[0]);
						
						let a = document.createElement('a');
						{
							a.classList.add('close');
							a.href = '#';
							a.dataset.dismiss = 'alert';
							a.innerHTML = '&times;';
							a.setAttribute('aria-label', 'close');
						}
						let message = document.createTextNode(item[1])
						
						div.appendChild(a);
						div.appendChild(message);
					}
					
					this.consoleElement.appendChild(div);
				}
			}
			
			changeConsoleElement(consoleElement) {
				this.consoleElement = consoleElement;
				
				if (this.consoleElement !== null) {
					this.flush();
				}
			}
			
			pushMessage(alertClass, messages) {
				this.queue.push([alertClass, this.convertIntoMessage(messages)]);
				this.flush();
			}
			
			convertIntoMessage(messages) {
				return messages.join(', ');
			}
			
			assert(assertion, ...messages) {
				this.console.assert(assertion, ...messages);
				if (assertion) return;
				
				this.pushMessage('alert-danger', messages);
			}
			
			clear() {
				if (this.consoleElement !== null) {
					while (this.consoleElement.firstChild) {
						this.consoleElement.removeChild(this.consoleElement.firstChild);
					}
				}
			}
			
			debug() {
				return this.log();
			}
			
			error(...messages) {
				let result = this.console.error(...messages)
				this.pushMessage('alert-danger', messages);
				return result;
			}
			
			exception() {
				return this.error();
			}
				
			info(...messages) {
				let result = this.console.info(...messages);
				this.pushMessage('alert-secondary', messages);
				return result;
			}
			
			log(...messages) {
				let result = this.console.info(...messages);
				this.pushMessage('alert-primary', messages);
				return result;
			}
		}

		window.addEventListener('load', e => {
			let sadConsole = new SadConsole(window.console);
			sadConsole.changeConsoleElement(document.getElementById('section-console'));
			window.console = sadConsole;
		});

		window.addEventListener('error', e => {
			window.console.error(
				`${e.message
				} (${e.filename.substring(e.filename.indexOf('/') + 1)
				} at ${e.lineno}:${e.colno})`
			);
		});
	}
}
