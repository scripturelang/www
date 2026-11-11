
export async function sleep_millis(milliseconds) {
    const deadline = performance.now() + milliseconds;
    do {
        await new Promise(resolve => setTimeout(resolve, Math.ceil(milliseconds)));
        milliseconds = deadline - performance.now();
    } while (milliseconds > 0);
}
