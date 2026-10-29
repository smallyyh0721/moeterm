const OSC = /\u001B\][\s\S]*?(?:\u0007|\u001B\\)/g;
const CSI = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const ESC = /\u001B[@-_]/g;

export function stripAnsi(input: string): string {
  return input.replace(OSC, '').replace(CSI, '').replace(ESC, '');
}
