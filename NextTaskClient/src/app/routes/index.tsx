import { FC } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "@app/providers/protected-route";
import {
	publicRoutes,
	privateRoutes,
	fallbackRoutes,
	type AppRoute,
} from "./routes";

const renderRoutes = (routes: AppRoute[]) =>
	routes.map((route) => (
		<Route
			key={route.path ?? "no-path"}
			path={route.path}
			element={route.element}
		>
			{route.children ? renderRoutes(route.children) : null}
		</Route>
	));

const AppRoutes: FC = () => {
	return (
		<Routes>
			{renderRoutes(publicRoutes)}
			<Route element={<ProtectedRoute />}>
				{renderRoutes(privateRoutes)}
			</Route>
			{renderRoutes(fallbackRoutes)}
		</Routes>
	);
};

export default AppRoutes;
