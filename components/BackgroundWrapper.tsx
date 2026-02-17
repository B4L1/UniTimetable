
import React from 'react';
import { useTheme } from '@/hooks/useTheme';

export default function BackgroundWrapper() {
    const { Component } = useTheme();

    if (!Component) return null;

    return <Component />;
}
