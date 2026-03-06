import { FC } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@entities/user";
import Layout from "@widgets/layout/ui";

const ProtectedRoute: FC = () => {
	const { user } = useAuthStore();

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return (
		<Layout>
			<Outlet />
		</Layout>
	);
};

export default ProtectedRoute;
