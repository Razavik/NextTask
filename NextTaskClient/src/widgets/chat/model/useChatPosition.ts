import { useEffect, useRef, useState } from "react";

type Position = { x: number; y: number };

interface UseChatPositionOptions {
	chatId: string;
	width: number;
	height: number;
	allowPartialOffscreen?: boolean;
}

export const useChatPosition = ({
	chatId,
	width,
	height,
	allowPartialOffscreen = true,
}: UseChatPositionOptions) => {
	const chatRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<Position | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

	const clampPosition = (
		x: number,
		y: number,
		clampWidth: number,
		clampHeight: number,
		allowPartial = false,
	) => {
		const MIN_VISIBLE = 50;
		const EDGE_MARGIN = 10;
		if (allowPartial) {
			const minX = -(clampWidth - MIN_VISIBLE);
			const maxX = window.innerWidth - MIN_VISIBLE;
			const minY = -(clampHeight - MIN_VISIBLE);
			const maxY = window.innerHeight - MIN_VISIBLE;
			return {
				x: Math.max(minX, Math.min(x, maxX)),
				y: Math.max(minY, Math.min(y, maxY)),
			};
		}
		const maxX = window.innerWidth - clampWidth - EDGE_MARGIN;
		const maxY = window.innerHeight - clampHeight - EDGE_MARGIN;
		return {
			x: Math.max(EDGE_MARGIN, Math.min(x, maxX)),
			y: Math.max(EDGE_MARGIN, Math.min(y, maxY)),
		};
	};

	const getHeight = () => chatRef.current?.offsetHeight || height;

	useEffect(() => {
		const savedPosition = localStorage.getItem(`chat-position-${chatId}`);
		if (savedPosition) {
			const pos = JSON.parse(savedPosition) as Position;
			// При открытии делаем строгую проверку (allowPartial = false),
			// чтобы чат всегда был полностью видим на экране
			const clamped = clampPosition(pos.x, pos.y, width, height, false);
			setPosition(clamped);
			return;
		}
		const defaultX = window.innerWidth - (width + 20);
		const defaultY = window.innerHeight - (height + 20);
		setPosition({ x: Math.max(20, defaultX), y: Math.max(20, defaultY) });
	}, [chatId, height, width]);

	useEffect(() => {
		if (position) {
			localStorage.setItem(
				`chat-position-${chatId}`,
				JSON.stringify(position),
			);
		}
	}, [position, chatId]);

	// Корректировка позиции при изменении размера окна
	useEffect(() => {
		const handleResize = () => {
			setPosition((prev) => {
				if (!prev) return prev;
				const clamped = clampPosition(
					prev.x,
					prev.y,
					width,
					getHeight(),
					false,
				);
				if (clamped.x !== prev.x || clamped.y !== prev.y) {
					return clamped;
				}
				return prev;
			});
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [width]);

	const startDrag = (clientX: number, clientY: number) => {
		if (!position) return;
		setIsDragging(true);
		setDragOffset({
			x: clientX - position.x,
			y: clientY - position.y,
		});
	};

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!isDragging || !position) return;
			const newX = e.clientX - dragOffset.x;
			const newY = e.clientY - dragOffset.y;
			const clamped = clampPosition(
				newX,
				newY,
				width,
				getHeight(),
				allowPartialOffscreen,
			);
			if (clamped.x !== position.x || clamped.y !== position.y) {
				setPosition(clamped);
			}
		};

		const handleMouseUp = () => {
			if (!isDragging || !position) return;
			setIsDragging(false);
			const snapped = clampPosition(
				position.x,
				position.y,
				width,
				getHeight(),
				false,
			);
			if (snapped.x !== position.x || snapped.y !== position.y) {
				setPosition(snapped);
			}
		};

		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [dragOffset, isDragging, position, width]);

	return {
		chatRef,
		position,
		isDragging,
		startDrag,
	};
};
