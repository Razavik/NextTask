import { FC } from "react";
import { useAuthStore } from "@entities/user";
import { useChatStore } from "@entities/chat";
import { useToastStore } from "@shared/model/toastStore";
import Chat from "@widgets/chat/ui";
import { useChatNotifications } from "@widgets/chat-container/model/useChatNotifications";

/**
 * Контейнер для отображения единого окна чата
 * Рендерится на уровне App, поэтому чат сохраняется при переходах между страницами
 */
const ChatContainer: FC = () => {
	const {
		isOpen,
		openWindow,
		activeChat,
		contacts,
		upsertAndTouchContact,
		incrementUnread,
		clearUnread,
		setActiveChat,
	} = useChatStore();
	const { token: authToken, user: currentUser } = useAuthStore();
	const addToast = useToastStore((state) => state.addToast);

	const isAuthPage =
		/\/login/i.test(window.location.pathname) ||
		/\/register/i.test(window.location.pathname);

	useChatNotifications({
		authToken,
		isAuthPage,
		activeChat,
		contacts,
		currentUserId: currentUser?.id,
		isOpen,
		incrementUnread,
		clearUnread,
		setActiveChat,
		openWindow,
		upsertAndTouchContact,
		addToast,
	});

	// Не рендерим UI на страницах аутентификации или без токена (hooks уже объявлены выше — порядок стабилен)
	if (!authToken || isAuthPage) {
		return null;
	}

	return <>{isOpen && <Chat />}</>;
};

export default ChatContainer;
