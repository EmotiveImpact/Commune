import { createFileRoute } from '@tanstack/react-router';
import { RouteError } from '../../components/route-error';

export const Route = createFileRoute('/_app/breakdown')({
  errorComponent: RouteError,
});
