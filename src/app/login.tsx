import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { KeyboardAvoidingView, ScrollView, Text, TouchableOpacity, View } from '../tw';
import { Banner, Button, Card, Divider, Field, Input } from '../components/ui';
import { useThemeMode } from '../context/ThemeModeContext';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { colors } = useThemeMode();

  const handleSubmit = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link, then sign in here.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.message);
      }
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior="padding">
      <ScrollView
        contentContainerClassName="flex-grow justify-center p-4"
        keyboardShouldPersistTaps="handled"
      >
        <Card className="p-6">
          <View className="items-center mb-5">
            <MaterialIcons name="biotech" size={48} color={colors.primary} />
            <Text className="text-xl font-bold text-primary mt-1">PeptideIQ</Text>
            <Text className="text-[13px] text-muted mt-1">
              {isSignUp ? 'Create an account' : 'Sign in to track your peptides'}
            </Text>
          </View>

          {error ? <View className="mb-3"><Banner tone="error">{error}</Banner></View> : null}
          {message ? <View className="mb-3"><Banner tone="success">{message}</Banner></View> : null}

          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isSignUp ? 'new-password' : 'password'}
              placeholder={isSignUp ? 'Minimum 6 characters' : 'Password'}
            />
          </Field>

          <Button
            title={loading ? 'Loading…' : isSignUp ? 'Sign Up' : 'Sign In'}
            onPress={handleSubmit}
            disabled={loading || !email || !password}
            className="mt-1"
          />

          <Divider className="my-4" />

          <TouchableOpacity onPress={() => { setIsSignUp(v => !v); setError(''); setMessage(''); }}>
            <Text className="text-[13px] text-primary text-center">
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>

          <Text className="text-[11px] text-muted text-center mt-4">
            Educational tool — not medical advice
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
