export const formatDuration = (totalSeconds: number): string => {
	const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);
	const seconds = safeSeconds % 60;
	const pad = (value: number) => value.toString().padStart(2, "0");

	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};
