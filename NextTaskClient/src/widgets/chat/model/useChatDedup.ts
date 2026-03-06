import { useRef, useCallback } from "react";
import type { WorkspaceMessage } from "@entities/chat";
import type { Message } from "@shared/types/message";

const RECENT_TTL_MS = 5000;

const makeMsgKey = (m: Message | WorkspaceMessage): string => {
	if ("workspace_id" in m) {
		return `ws|${m.workspace_id}|${m.sender_id}|${m.content}`;
	}
	const pm = m as Message;
	return `pm|${pm.sender_id}|${pm.receiver_id}|${pm.content}`;
};

/**
 * Хук для дедупликации сообщений в коротком временном окне.
 * Возвращает функцию shouldAcceptMessage, которая возвращает true,
 * если сообщение не является дубликатом.
 */
export const useChatDedup = () => {
	const recentKeysRef = useRef<Map<string, number>>(new Map());

	const shouldAcceptMessage = useCallback(
		(m: Message | WorkspaceMessage): boolean => {
			const now = Date.now();
			for (const [k, ts] of Array.from(recentKeysRef.current.entries())) {
				if (now - ts > RECENT_TTL_MS) recentKeysRef.current.delete(k);
			}
			const key = makeMsgKey(m);
			const ts = recentKeysRef.current.get(key);
			if (ts && now - ts <= RECENT_TTL_MS) {
				return false;
			}
			recentKeysRef.current.set(key, now);
			return true;
		},
		[],
	);

	return { shouldAcceptMessage };
};
