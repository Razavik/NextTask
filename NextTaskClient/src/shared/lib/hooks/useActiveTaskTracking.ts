import { useEffect, useMemo, useState } from "react";

interface PersistedTrackingSession {
	taskId: number;
	accumulatedSeconds: number;
	startedAt: number | null;
}

const TRACKING_SESSION_STORAGE_KEY = "active-task-tracking-session";

const readTrackingSession = (): PersistedTrackingSession | null => {
	try {
		const rawValue = localStorage.getItem(TRACKING_SESSION_STORAGE_KEY);
		if (!rawValue) return null;

		const parsed = JSON.parse(rawValue) as Partial<PersistedTrackingSession>;
		if (
			typeof parsed.taskId !== "number" ||
			typeof parsed.accumulatedSeconds !== "number"
		) {
			return null;
		}

		return {
			taskId: parsed.taskId,
			accumulatedSeconds: parsed.accumulatedSeconds,
			startedAt:
				typeof parsed.startedAt === "number" ? parsed.startedAt : null,
		};
	} catch {
		return null;
	}
};

const getElapsedSeconds = (session: PersistedTrackingSession) => {
	if (!session.startedAt) {
		return session.accumulatedSeconds;
	}

	return (
		session.accumulatedSeconds +
		Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000))
	);
};

export const useActiveTaskTracking = (
	taskId: number,
	baseTimeSpent: number,
) => {
	const [liveSeconds, setLiveSeconds] = useState<number | null>(null);

	useEffect(() => {
		const session = readTrackingSession();
		const isActiveForTask =
			!!session && session.taskId === taskId && session.startedAt !== null;

		if (!isActiveForTask || !session) {
			setLiveSeconds(null);
			return;
		}

		const update = () => {
			const current = readTrackingSession();
			if (
				!current ||
				current.taskId !== taskId ||
				current.startedAt === null
			) {
				setLiveSeconds(null);
				return;
			}

			setLiveSeconds(getElapsedSeconds(current));
		};

		update();
		const intervalId = setInterval(update, 1000);
		return () => clearInterval(intervalId);
	}, [taskId]);

	const displaySeconds = useMemo(
		() =>
			liveSeconds === null
				? baseTimeSpent
				: Math.max(0, baseTimeSpent + liveSeconds),
		[liveSeconds, baseTimeSpent],
	);

	return {
		displaySeconds,
		isActiveTracking: liveSeconds !== null,
	};
};
