import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, GraduationCap, Check } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { useClassLevels } from '../../hooks/useClassLevels';
import { Colors } from '../../theme';

type ClassSwitcherProps = {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function ClassSwitcher({ isOpen, onToggle, onClose }: ClassSwitcherProps) {
  const { user, studentSelectedClass, setStudentSelectedClass } = useAuth();
  const { classLevels } = useClassLevels();

  const availableClassOptions = useMemo(() => {
    const isAll = user?.isAllStudentClasses || !user?.studentClasses || user.studentClasses.length === 0;

    if (isAll) {
      const dbOptions = classLevels
        .filter((lvl) => !lvl.isAny && lvl.value !== 'ANY')
        .map((lvl) => ({
          key: lvl.value,
          label: lvl.label,
        }));
      return [{ key: 'ANY', label: 'All Classes' }, ...dbOptions];
    }

    const assigned = user.studentClasses || [];
    const options = assigned.map((code) => {
      const match = classLevels.find((lvl) => lvl.value.toLowerCase() === code.toLowerCase());
      return {
        key: code,
        label: match ? match.label : code,
      };
    });

    if (options.length > 1) {
      return [{ key: 'ANY', label: 'All My Classes' }, ...options];
    }
    return options;
  }, [user?.isAllStudentClasses, user?.studentClasses, classLevels]);

  const currentLabel = useMemo(() => {
    if (!studentSelectedClass || studentSelectedClass === 'ANY') {
      return user?.isAllStudentClasses || !user?.studentClasses?.length ? 'ALL CLASSES' : 'MY CLASSES';
    }
    const match = classLevels.find((lvl) => lvl.value.toLowerCase() === studentSelectedClass.toLowerCase());
    return (match ? match.label : studentSelectedClass).toUpperCase();
  }, [studentSelectedClass, classLevels, user?.isAllStudentClasses, user?.studentClasses]);

  const handleSelectClass = (classKey: string) => {
    setStudentSelectedClass(classKey);
    onClose();
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onToggle}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel={`Switch class, currently ${currentLabel}`}
      >
        <GraduationCap size={13} color={Colors.primary} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {currentLabel}
        </Text>
        <ChevronDown size={13} color={Colors.primary} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
        <View style={styles.menuAbsolute}>
          <View style={styles.menu}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>SELECT CLASS</Text>
            </View>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} bounces={false}>
              {availableClassOptions.map((opt) => {
                const isSelected =
                  (!studentSelectedClass && opt.key === 'ANY') ||
                  studentSelectedClass === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => handleSelectClass(opt.key)}
                    style={[styles.classButton, isSelected && styles.classButtonActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${opt.label}`}
                  >
                    <Text style={[styles.classText, isSelected && styles.classTextActive]}>
                      {opt.label}
                    </Text>
                    {isSelected && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  menuAbsolute: {
    position: 'absolute',
    top: 56,
    right: 56,
    zIndex: 200,
  },
  trigger: {
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    maxWidth: 130,
  },
  triggerText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.3,
    maxWidth: 80,
  },
  menu: {
    width: 190,
    maxHeight: 340,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 16,
    padding: 8,
    zIndex: 20,
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  menuHeader: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F4F9',
    marginBottom: 4,
  },
  menuTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8A92A6',
    letterSpacing: 0.5,
  },
  scrollView: {
    maxHeight: 280,
  },
  classButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 3,
    backgroundColor: '#F8F9FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classButtonActive: {
    backgroundColor: Colors.primary,
  },
  classText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3C4054',
  },
  classTextActive: {
    color: '#ffffff',
  },
});
