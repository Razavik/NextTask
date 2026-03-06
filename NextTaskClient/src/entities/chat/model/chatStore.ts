import { create } from "zustand";

export interface ChatContact {
	id: string;
	type: "personal" | "group";
	userId?: number;
	chatId?: number;
	name: string;
	avatar?: string;
	lastActivityAt?: string;
	unreadCount?: number;
	workspaceId?: number;
}

export interface ActiveChat {
	contactId: string;
	type: "personal" | "group";
	userId?: number;
	chatId?: number;
	name: string;
	avatar?: string;
}

interface ChatState {
	isOpen: boolean;
	activeChat: ActiveChat | null;
	contacts: ChatContact[];
	shouldExpand: boolean;
	lastActiveContactId: string | null;
	currentWorkspaceId?: number;

	openWindow: () => void;
	openChat: (contact: ChatContact) => void;
	addContacts: (contacts: ChatContact[]) => void;
	upsertAndTouchContact: (contact: ChatContact) => void;
	setContactsOrder: (order: string[]) => void;
	ackExpand: () => void;
	setActiveChat: (contactId: string) => void;
	closeChat: () => void;
	toggleChat: () => void;
	incrementUnread: (contactId: string) => void;
	clearUnread: (contactId: string) => void;
	removeContact: (contactId: string) => void;
	reset: () => void;
	setCurrentWorkspaceId: (workspaceId?: number) => void;
}

const initialState = () => ({
	isOpen: false,
	activeChat: null,
	contacts: [],
	shouldExpand: false,
	lastActiveContactId: null,
	currentWorkspaceId: undefined,
});

export const useChatStore = create<ChatState>((set, get) => {
	const baseState = initialState();
	return {
		...baseState,

		openWindow: () => {
			const state = get();
			set({ isOpen: true, shouldExpand: true });
			if (!state.activeChat && state.lastActiveContactId) {
				const remembered = state.contacts.find(
					(c) => c.id === state.lastActiveContactId,
				);
				if (remembered) {
					set({
						activeChat: {
							contactId: remembered.id,
							type: remembered.type,
							userId: remembered.userId,
							chatId: remembered.chatId,
							name: remembered.name,
							avatar: remembered.avatar,
						},
					});
				}
			}
		},

		openChat: (contact) => {
			set((state) => {
				const existsIdx = state.contacts.findIndex(
					(c) => c.id === contact.id,
				);
				const touched: ChatContact = {
					...contact,
					lastActivityAt: new Date().toISOString(),
				};
				let newContacts = [...state.contacts];

				if (existsIdx >= 0) {
					const merged = { ...newContacts[existsIdx], ...touched };
					newContacts.splice(existsIdx, 1);
					newContacts.unshift(merged);
				} else {
					newContacts.unshift(touched);
				}

				return {
					isOpen: true,
					shouldExpand: true,
					contacts: newContacts,
					activeChat: {
						contactId: contact.id,
						type: contact.type,
						userId: contact.userId,
						chatId: contact.chatId,
						name: contact.name,
						avatar: contact.avatar,
					},
					lastActiveContactId: contact.id,
				};
			});
		},

		setActiveChat: (contactId) => {
			set((state) => {
				const contact = state.contacts.find((c) => c.id === contactId);
				if (!contact) return state;
				return {
					activeChat: {
						contactId: contact.id,
						type: contact.type,
						userId: contact.userId,
						chatId: contact.chatId,
						name: contact.name,
						avatar: contact.avatar,
					},
					lastActiveContactId: contact.id,
				};
			});
		},

		addContacts: (newContacts) => {
			set((state) => {
				const seen = new Set(state.contacts.map((c) => c.id));
				const filteredNew = newContacts.filter((c) => !seen.has(c.id));
				return { contacts: [...state.contacts, ...filteredNew] };
			});
		},

		upsertAndTouchContact: (contact) => {
			set((state) => {
				let newContacts = [...state.contacts];
				const idx = newContacts.findIndex((c) => c.id === contact.id);
				const lastActivityAt =
					contact.lastActivityAt || new Date().toISOString();

				if (idx >= 0) {
					const merged = {
						...newContacts[idx],
						...contact,
						lastActivityAt,
					};
					newContacts.splice(idx, 1);
					newContacts.unshift(merged);
				} else {
					newContacts.unshift({ ...contact, lastActivityAt });
				}

				// Deduplicate and sort
				const seen = new Set();
				newContacts = newContacts.filter((c) => {
					if (seen.has(c.id)) return false;
					seen.add(c.id);
					return true;
				});

				newContacts.sort((a, b) => {
					const aTime = a.lastActivityAt
						? new Date(a.lastActivityAt).getTime()
						: 0;
					const bTime = b.lastActivityAt
						? new Date(b.lastActivityAt).getTime()
						: 0;
					return bTime - aTime;
				});

				return { contacts: newContacts };
			});
		},

		setContactsOrder: (order) => {
			set((state) => {
				const map = new Map(
					state.contacts.map((c) => [c.id, c] as const),
				);
				const reordered: ChatContact[] = [];
				for (const id of order) {
					const c = map.get(id);
					if (c) {
						reordered.push(c);
						map.delete(id);
					}
				}
				for (const c of state.contacts) {
					if (!order.includes(c.id)) reordered.push(c);
				}

				reordered.sort((a, b) => {
					const aTime = a.lastActivityAt
						? new Date(a.lastActivityAt).getTime()
						: 0;
					const bTime = b.lastActivityAt
						? new Date(b.lastActivityAt).getTime()
						: 0;
					return bTime - aTime;
				});

				return { contacts: reordered };
			});
		},

		ackExpand: () => set({ shouldExpand: false }),

		closeChat: () => {
			set({
				activeChat: null,
				isOpen: false,
				lastActiveContactId:
					get().activeChat?.contactId ?? get().lastActiveContactId,
			});
		},

		toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

		incrementUnread: (contactId) => {
			set((state) => ({
				contacts: state.contacts.map((c) =>
					c.id === contactId
						? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
						: c,
				),
			}));
		},

		clearUnread: (contactId) => {
			set((state) => ({
				contacts: state.contacts.map((c) =>
					c.id === contactId ? { ...c, unreadCount: 0 } : c,
				),
			}));
		},

		removeContact: (contactId) => {
			set((state) => {
				const newContacts = state.contacts.filter(
					(c) => c.id !== contactId,
				);
				let nextActive = state.activeChat;

				if (state.activeChat?.contactId === contactId) {
					if (newContacts.length > 0) {
						const first = newContacts[0];
						nextActive = {
							contactId: first.id,
							type: first.type,
							userId: first.userId,
							chatId: first.chatId,
							name: first.name,
							avatar: first.avatar,
						};
					} else {
						nextActive = null;
					}
				}

				return {
					contacts: newContacts,
					activeChat: nextActive,
					lastActiveContactId:
						nextActive?.contactId ??
						(state.lastActiveContactId === contactId
							? null
							: state.lastActiveContactId),
				};
			});
		},

		setCurrentWorkspaceId: (workspaceId?: number) => {
			set({ currentWorkspaceId: workspaceId });
		},

		reset: () => {
			set(initialState());
		},
	};
});

export const selectTotalUnreadCount = (state: ChatState) =>
	state.contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
