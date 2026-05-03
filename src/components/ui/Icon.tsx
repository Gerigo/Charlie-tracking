import React, { ComponentType } from 'react';

// Import each icon via its individual module path so Metro doesn't pull
// the entire 1500-icon barrel (which inflates the bundle by ~6 MB).
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ArrowsClockwise } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { Bug } from 'phosphor-react-native/src/icons/Bug';
import { Calendar } from 'phosphor-react-native/src/icons/Calendar';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { ChartBar } from 'phosphor-react-native/src/icons/ChartBar';
import { ChartLineUp } from 'phosphor-react-native/src/icons/ChartLineUp';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon as Circle } from 'phosphor-react-native/src/icons/Circle';
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { DotsThree } from 'phosphor-react-native/src/icons/DotsThree';
import { Eye } from 'phosphor-react-native/src/icons/Eye';
import { FileText } from 'phosphor-react-native/src/icons/FileText';
import { FolderOpen } from 'phosphor-react-native/src/icons/FolderOpen';
import { ForkKnife } from 'phosphor-react-native/src/icons/ForkKnife';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { Info } from 'phosphor-react-native/src/icons/Info';
import { Leaf } from 'phosphor-react-native/src/icons/Leaf';
import { MinusCircle } from 'phosphor-react-native/src/icons/MinusCircle';
import { Moon } from 'phosphor-react-native/src/icons/Moon';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { PlusCircle } from 'phosphor-react-native/src/icons/PlusCircle';
import { Share } from 'phosphor-react-native/src/icons/Share';
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { Sun } from 'phosphor-react-native/src/icons/Sun';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { User } from 'phosphor-react-native/src/icons/User';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle';
import { X } from 'phosphor-react-native/src/icons/X';
import type { IconProps as PhosphorProps } from 'phosphor-react-native';

/**
 * Map Ionicons-flavored names → Phosphor components.
 * Outline variants → "regular" weight. Filled variants → "fill" weight.
 */
type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

interface Entry {
  Component: ComponentType<PhosphorProps>;
  weight?: IconWeight;
}

const REGISTRY: Record<string, Entry> = {
  add: { Component: Plus, weight: 'bold' },
  'add-circle': { Component: PlusCircle, weight: 'fill' },
  'add-circle-outline': { Component: PlusCircle },
  'alert-circle-outline': { Component: WarningCircle },
  analytics: { Component: ChartLineUp, weight: 'fill' },
  'analytics-outline': { Component: ChartLineUp },
  'arrow-back': { Component: ArrowLeft },
  'bug-outline': { Component: Bug },
  'calendar-outline': { Component: CalendarBlank },
  camera: { Component: Camera, weight: 'fill' },
  'checkmark-circle': { Component: CheckCircle, weight: 'fill' },
  'checkmark-circle-outline': { Component: CheckCircle },
  'chevron-forward': { Component: CaretRight },
  close: { Component: X, weight: 'bold' },
  'create-outline': { Component: PencilSimple },
  'document-text-outline': { Component: FileText },
  ellipse: { Component: Circle, weight: 'fill' },
  'ellipse-outline': { Component: Circle },
  'ellipsis-horizontal': { Component: DotsThree, weight: 'bold' },
  'eye-outline': { Component: Eye },
  'folder-open': { Component: FolderOpen, weight: 'fill' },
  'folder-open-outline': { Component: FolderOpen },
  heart: { Component: Heart, weight: 'fill' },
  'heart-outline': { Component: Heart },
  'information-circle-outline': { Component: Info },
  'leaf-outline': { Component: Leaf },
  moon: { Component: Moon, weight: 'fill' },
  'moon-outline': { Component: Moon },
  'pencil-outline': { Component: PencilSimple },
  people: { Component: Users, weight: 'fill' },
  'people-outline': { Component: Users },
  'person-add-outline': { Component: UserPlus },
  'person-circle': { Component: UserCircle, weight: 'fill' },
  'person-circle-outline': { Component: UserCircle },
  'person-outline': { Component: User },
  'remove-circle-outline': { Component: MinusCircle },
  'restaurant-outline': { Component: ForkKnife },
  'share-outline': { Component: Share },
  'shield-checkmark-outline': { Component: ShieldCheck },
  'sparkles-outline': { Component: Sparkle },
  'stats-chart': { Component: ChartBar, weight: 'fill' },
  'stats-chart-outline': { Component: ChartBar },
  'sunny-outline': { Component: Sun },
  'sync-outline': { Component: ArrowsClockwise },
  'time-outline': { Component: Clock },
  today: { Component: Calendar, weight: 'fill' },
  'today-outline': { Component: Calendar },
  'trash-outline': { Component: Trash },
  'warning-outline': { Component: Warning },
};

interface Props {
  name: string;
  size?: number;
  color?: string;
  weight?: IconWeight;
  style?: PhosphorProps['style'];
}

/**
 * Drop-in replacement for Ionicons. Same name/size/color API.
 * Falls back to a placeholder if the name is unknown (logged once in dev).
 */
export function Icon({ name, size = 18, color, weight, style }: Props): React.ReactElement | null {
  const entry = REGISTRY[name];
  if (!entry) {
    if (__DEV__) {
      console.warn(`[Icon] Unknown name: "${name}" — fallback to CaretRight`);
    }
    return <CaretRight size={size} color={color} weight={weight ?? 'regular'} style={style} />;
  }
  const { Component, weight: defaultWeight } = entry;
  return <Component size={size} color={color} weight={weight ?? defaultWeight ?? 'regular'} style={style} />;
}

export default Icon;
