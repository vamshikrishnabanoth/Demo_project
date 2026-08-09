/**
 * Background Tab-Switch Resilient Timer Worker
 * Prevents Chrome / browser background tab throttling for 4-hour recording sessions.
 */

export function createTimerWorker() {
  const workerCode = `
    let timerId = null;
    let elapsedSeconds = 0;

    self.onmessage = function(e) {
      const { command, seconds } = e.data;

      if (command === 'start') {
        elapsedSeconds = seconds || 0;
        if (timerId) clearInterval(timerId);
        timerId = setInterval(() => {
          elapsedSeconds++;
          self.postMessage({ type: 'tick', seconds: elapsedSeconds });
        }, 1000);
      } else if (command === 'pause') {
        if (timerId) clearInterval(timerId);
        timerId = null;
      } else if (command === 'resume') {
        if (timerId) clearInterval(timerId);
        timerId = setInterval(() => {
          elapsedSeconds++;
          self.postMessage({ type: 'tick', seconds: elapsedSeconds });
        }, 1000);
      } else if (command === 'stop') {
        if (timerId) clearInterval(timerId);
        timerId = null;
        elapsedSeconds = 0;
        self.postMessage({ type: 'stopped' });
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}
