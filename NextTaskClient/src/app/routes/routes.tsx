import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Login, Register } from "@features/auth";
import Workspaces from "@pages/workspaces";
import CreateWorkspace from "@pages/workspaces/components/create";
import WorkspaceDetails from "@pages/workspace-details";
import Invite from "@pages/invite";
import Profile from "@pages/profile";
import ProfileSettings from "@pages/profile-settings";
import WorkspaceSettings from "@pages/workspace-settings";
import Task from "@pages/task";
import Settings from "@pages/settings";
import Planning from "@pages/planning/index";

export type AppRoute = {
	path?: string;
	element?: ReactNode;
	children?: AppRoute[];
};

export const publicRoutes: AppRoute[] = [
	{ path: "/login", element: <Login /> },
	{ path: "/register", element: <Register /> },
	{ path: "/invite/:token", element: <Invite /> },
];

export const privateRoutes: AppRoute[] = [
	{ path: "/workspaces", element: <Workspaces /> },
	{ path: "/workspaces/create", element: <CreateWorkspace /> },
	{
		path: "/workspaces/workspace/:workspaceId",
		element: <WorkspaceDetails />,
	},
	{
		path: "/workspaces/workspace/:workspaceId/tasks/:taskId",
		element: <Task />,
	},
	{
		path: "/workspaces/workspace/:workspaceId/settings/:tab",
		element: <WorkspaceSettings />,
	},
	{ path: "/profile", element: <Navigate to="/profile/general" replace /> },
	{ path: "/profile/:tab", element: <Profile /> },
	{ path: "/profile/settings", element: <ProfileSettings /> },
	{ path: "/planning", element: <Planning /> },
	{ path: "/settings", element: <Settings /> },
];

export const fallbackRoutes: AppRoute[] = [
	{ path: "/", element: <Navigate to="/workspaces" replace /> },
	{ path: "*", element: <Navigate to="/workspaces" replace /> },
];
