// This layout can be used for common elements or context providers
// specific to the authenticated parts of the application.
// For now, it just renders the children.

export default function AppAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
