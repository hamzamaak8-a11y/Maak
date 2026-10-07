import React from 'react';
import { Text, View } from 'react-native';
import { Button } from './ui';

/** Last line of defence: a render crash shows a recoverable screen instead of a blank app. */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('Unhandled UI error', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: '#F8FAFC' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>MAAK</Text>
        <Text style={{ color: '#64748B', textAlign: 'center', lineHeight: 22 }}>Something went wrong · حدث خطأ ما · Une erreur est survenue</Text>
        <Button title="OK" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}
