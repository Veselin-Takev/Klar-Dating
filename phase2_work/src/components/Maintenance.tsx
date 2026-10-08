import { MaintenanceOverlay, type MaintenanceOverlayProps } from "./MaintenanceOverlay";

export interface MaintenanceProps extends MaintenanceOverlayProps {}

export function Maintenance(props: MaintenanceProps) {
  return <MaintenanceOverlay {...props} />;
}

export { MaintenanceOverlay };
