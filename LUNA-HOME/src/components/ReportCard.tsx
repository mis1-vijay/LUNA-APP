import React from 'react';
import ResourceCard from './ResourceCard';

type ReportCardProps = {
  title: string;
  subtitle: string;
  onPress?: () => void;
};

export default function ReportCard({ title, subtitle, onPress }: ReportCardProps) {
  return (
    <ResourceCard
      title={title}
      subtitle={subtitle}
      meta="Report"
      accentColor="#22c55e"
      onPress={onPress}
    />
  );
}
