import { FC } from "react";
import { Play, Pause, Save, Clock } from "lucide-react";
import Button from "@shared/ui/button";
import Textarea from "@shared/ui/textarea";
import Input from "@shared/ui/input";
import styles from "../index.module.css";

interface TimerPanelProps {
	isTracking: boolean;
	isManualInput: boolean;
	isSaving: boolean;
	localTimeSpent: number;
	comment: string;
	manualHours: string;
	manualMinutes: string;
	canSaveTime: boolean;
	setComment: (comment: string) => void;
	setManualHours: (hours: string) => void;
	setManualMinutes: (minutes: string) => void;
	setIsManualInput: (isManual: boolean) => void;
	toggleTracking: () => void;
	handleSaveManualTime: () => void;
	saveTimeTrack: () => void;
	formatTime: (seconds: number) => string;
}

export const TimerPanel: FC<TimerPanelProps> = ({
	isTracking,
	isManualInput,
	isSaving,
	localTimeSpent,
	comment,
	manualHours,
	manualMinutes,
	canSaveTime,
	setComment,
	setManualHours,
	setManualMinutes,
	setIsManualInput,
	toggleTracking,
	handleSaveManualTime,
	saveTimeTrack,
	formatTime,
}) => {
	return (
		<div className={styles.trackerPanel}>
			<div className={styles.timerHeader}>
				<div className={styles.timerDisplay}>
					<Clock size={20} />
					{isManualInput ? (
						<div className={styles.manualInputGroup}>
							<div className={styles.manualInputWrapper}>
								<Input
									type="number"
									min="0"
									value={manualHours}
									onChange={(e) =>
										setManualHours(e.target.value)
									}
									onKeyDown={(e) => {
										if (
											e.key === "Enter" &&
											manualMinutes
										) {
											handleSaveManualTime();
										}
									}}
									placeholder="0"
									className={styles.timeInput}
								/>
								<span className={styles.timeUnit}>ч</span>
							</div>
							<div className={styles.manualInputWrapper}>
								<Input
									type="number"
									min="0"
									max="59"
									value={manualMinutes}
									onChange={(e) =>
										setManualMinutes(e.target.value)
									}
									onKeyDown={(e) => {
										if (e.key === "Enter" && manualHours) {
											handleSaveManualTime();
										}
									}}
									placeholder="0"
									className={styles.timeInput}
								/>
								<span className={styles.timeUnit}>м</span>
							</div>
						</div>
					) : (
						<span>{formatTime(localTimeSpent)}</span>
					)}
				</div>
				<div className={styles.timerControls}>
					{!isManualInput && (
						<Button
							variant={isTracking ? "ghost" : "primary"}
							onClick={toggleTracking}
							className={styles.timerBtn}
							disabled={isSaving}
							size="sm"
						>
							{isTracking ? (
								<>
									<Pause size={16} /> Пауза
								</>
							) : (
								<>
									<Play size={16} /> Запустить
								</>
							)}
						</Button>
					)}
					<Button
						variant="ghost"
						onClick={() => {
							setIsManualInput(!isManualInput);
							if (isTracking && !isManualInput) {
								toggleTracking();
							}
						}}
						className={styles.timerBtn}
						disabled={isSaving || isTracking}
						size="sm"
					>
						{isManualInput ? "Таймер" : "Ввести вручную"}
					</Button>
				</div>
			</div>

			<div className={styles.commentSection}>
				<Textarea
					placeholder="Оставьте комментарий к затраченному времени..."
					value={comment}
					onChange={(e) => setComment(e.target.value)}
					textareaClassName={styles.commentInput}
					disabled={isSaving}
				/>
				<div className={styles.saveAction}>
					<Button
						variant="primary"
						onClick={
							isManualInput ? handleSaveManualTime : saveTimeTrack
						}
						disabled={isSaving || !canSaveTime}
						className={styles.saveBtn}
						size="sm"
					>
						<Save size={16} />{" "}
						{isSaving ? "Сохранение..." : "Сохранить"}
					</Button>
				</div>
			</div>
		</div>
	);
};
