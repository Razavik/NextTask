import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { workspacesService } from "@entities/workspace";
import Input from "@shared/ui/input";
import Textarea from "@shared/ui/textarea";
import Button from "@shared/ui/button";
import styles from "./index.module.css";

/**
 * Страница создания нового рабочего пространства
 */
const CreateWorkspace = () => {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!name.trim()) {
			setError("Название рабочего пространства обязательно");
			return;
		}

		try {
			setIsSubmitting(true);
			setError("");

			const workspace = await workspacesService.createWorkspace({
				name: name.trim(),
				description: description || undefined,
			});

			navigate(`/workspaces/workspace/${workspace.id}`);
		} catch (err: any) {
			setError(
				err.message || "Ошибка при создании рабочего пространства",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className={styles.container}>
			<h1 className={styles.title}>Создание рабочего пространства</h1>

			{error && <div className={styles.error}>{error}</div>}

			<form className={styles.form} onSubmit={handleSubmit}>
				<Input
					id="name"
					type="text"
					label="Название *"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Введите название рабочего пространства"
					required
				/>

				<Textarea
					id="description"
					label="Описание"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Введите описание (необязательно)"
					rows={4}
				/>

				<div className={styles.actions}>
					<Button
						type="button"
						className={styles.cancelButton}
						onClick={() => navigate("/workspaces")}
					>
						Отмена
					</Button>
					<Button
						type="submit"
						className={styles.submitButton}
						disabled={isSubmitting}
					>
						{isSubmitting ? "Создание..." : "Создать"}
					</Button>
				</div>
			</form>
		</div>
	);
};

export default CreateWorkspace;
