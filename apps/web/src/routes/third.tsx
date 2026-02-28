import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/third")({
  component: ThirdPage,
});

function ThirdPage() {
  return <div />;
}
