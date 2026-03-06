import { FC, useState } from 'react';
import styles from './index.module.css';

// Модель для приглашения (пока простая)
interface Invitation {
    id: number;
    email: string;
    status: 'pending' | 'accepted';
    created_at: string;
}

const Invitations: FC = () => {
    const [email, setEmail] = useState('');
    const [invitations, setInvitations] = useState<Invitation[]>([]); // Тут будут храниться приглашения

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        console.log(`Приглашение отправлено на: ${email}`);
        // TODO: Добавить логику отправки через API
        // Временно добавляем в список для демонстрации
        setInvitations(prev => [...prev, { id: Date.now(), email, status: 'pending', created_at: new Date().toISOString() }]);
        setEmail('');
    };

    return (
        <div className={styles.invitationsContainer}>
            <div className={styles.createInvitationForm}>
                <h2>Отправить приглашение</h2>
                <form onSubmit={handleInvite}>
                    <input 
                        type="email" 
                        placeholder="Email пользователя" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <button type="submit">Отправить</button>
                </form>
            </div>

            <div className={styles.invitationsList}>
                <h2>Отправленные приглашения</h2>
                {invitations.length === 0 ? (
                    <p>Приглашений пока нет.</p>
                ) : (
                    <ul>
                        {/* Тут будет рендер списка приглашений */}
                        {invitations.map(inv => (
                            <li key={inv.id}>{inv.email} - {inv.status}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default Invitations;
