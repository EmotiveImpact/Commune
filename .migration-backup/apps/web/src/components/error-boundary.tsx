import { Component, type ReactNode } from 'react';
import {
  Stack, Title, Text, Button, Card, Center, ThemeIcon,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Center h="100vh" p="xl">
          <Card withBorder padding="xl" radius="md" maw={480} w="100%">
            <Stack align="center" gap="md">
              <ThemeIcon variant="light" color="red" size="xl">
                <IconAlertTriangle size={28} />
              </ThemeIcon>

              <Title order={3} ta="center">Something went wrong</Title>
              <Text c="dimmed" ta="center" size="sm">
                An unexpected error occurred. Please try again or refresh the page.
              </Text>

              {import.meta.env.DEV && this.state.error && (
                <Card withBorder padding="sm" radius="sm" bg="gray.0" w="100%">
                  <Text size="xs" ff="monospace" c="red" style={{ wordBreak: 'break-all' }}>
                    {this.state.error.message}
                  </Text>
                </Card>
              )}

              <Button onClick={this.handleReset} variant="light">
                Try again
              </Button>
            </Stack>
          </Card>
        </Center>
      );
    }

    return this.props.children;
  }
}
