import React from 'react';
import ResourceCard from './ResourceCard';

type FormCardProps = {
  title: string;
  subtitle: string;
  onPress?: () => void;
};

export default function FormCard({ title, subtitle, onPress }: FormCardProps) {
  return (
    <ResourceCard
      title={title}
      subtitle={subtitle}
      meta="Form"
      accentColor="#a78bfa"
      onPress={onPress}
    />
  );
}
