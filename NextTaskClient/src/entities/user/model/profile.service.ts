import api from "@shared/api/axios";

export interface ProfileData {
	id: number;
	email: string;
	name?: string;
	position?: string;
	avatar?: string;
	created_at?: string;
}

export interface ProfileUpdateRequest {
	name?: string;
	position?: string;
}

export interface PasswordChangeRequest {
	current_password: string;
	new_password: string;
}

class ProfileService {
	async getProfile(): Promise<ProfileData> {
		const { data } = await api.get<ProfileData>("/profile/me");
		return data;
	}

	async updateProfile(
		profileData: ProfileUpdateRequest,
	): Promise<ProfileData> {
		const { data } = await api.put<ProfileData>("/profile/me", profileData);
		return data;
	}

	async changePassword(passwordData: PasswordChangeRequest): Promise<void> {
		await api.post("/profile/change-password", passwordData);
	}

	async uploadAvatar(file: File): Promise<ProfileData> {
		const formData = new FormData();
		formData.append("avatar", file);

		const { data } = await api.post<ProfileData>(
			"/profile/avatar",
			formData,
			{
				headers: { "Content-Type": "multipart/form-data" },
			},
		);
		return data;
	}
}

export const profileService = new ProfileService();
