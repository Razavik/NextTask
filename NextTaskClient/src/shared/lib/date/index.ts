export const toLocalISOString = (date: Date | string): string => {
	const d = new Date(date);
	const tzOffset = d.getTimezoneOffset() * 60000; // смещение в миллисекундах
	const localISOTime = new Date(d.getTime() - tzOffset)
		.toISOString()
		.slice(0, 16);
	return localISOTime;
};
