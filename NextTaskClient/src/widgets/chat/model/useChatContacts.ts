import { useEffect } from "react";
import { chatService, type ChatContact } from "@entities/chat";

interface UseChatContactsOptions {
	addContacts: (contacts: ChatContact[]) => void;
	setContactsOrder: (ids: string[]) => void;
	scope: "current" | "all";
}

export const useChatContacts = ({
	addContacts,
	setContactsOrder,
	scope,
}: UseChatContactsOptions) => {
	// Инициализация: получить список чатов с бэка и установить порядок
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				// Загружаем разные данные в зависимости от scope
				const recent =
					scope === "all"
						? await chatService.getAll()
						: await chatService.getRecent();

				if (cancelled || !Array.isArray(recent)) return;
				const contactsToAdd: ChatContact[] = recent.map((r: any) => ({
					id: r.id,
					type: r.type,
					userId: r.user_id ?? r.userId,
					chatId: r.chat_id ?? r.chatId,
					name: r.name,
					avatar: r.avatar,
					lastActivityAt: r.last_activity_at ?? r.lastActivityAt,
					workspaceId: r.workspace_id ?? r.workspaceId,
				}));
				const orderIds = contactsToAdd.map((c) => c.id);
				addContacts(contactsToAdd);
				setContactsOrder(orderIds);
			} catch {
				// игнорируем стартовые ошибки загрузки recent
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [addContacts, setContactsOrder, scope]);
};
