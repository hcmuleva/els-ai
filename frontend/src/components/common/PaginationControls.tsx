import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native';

type Props = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  loading?: boolean;
  itemLabel?: string;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
};

function PaginationControlsBase({
  currentPage,
  totalPages,
  totalCount,
  loading = false,
  itemLabel = 'items',
  onFirst,
  onPrev,
  onNext,
  onLast,
}: Props) {
  if (totalPages <= 1 && totalCount <= 0) return null;

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <View style={s.wrap}>
      <View style={s.buttonsRow}>
        <Pressable
          style={[s.btn, !canPrev && s.btnDisabled]}
          onPress={onFirst}
          disabled={!canPrev}
          hitSlop={6}
        >
          <ChevronsLeft size={15} color={canPrev ? '#2B6FD5' : '#9BAAC2'} />
          <Text style={[s.btnText, !canPrev && s.btnTextDisabled]}>First</Text>
        </Pressable>
        <Pressable
          style={[s.btn, !canPrev && s.btnDisabled]}
          onPress={onPrev}
          disabled={!canPrev}
          hitSlop={6}
        >
          <ChevronLeft size={15} color={canPrev ? '#2B6FD5' : '#9BAAC2'} />
          <Text style={[s.btnText, !canPrev && s.btnTextDisabled]}>Prev</Text>
        </Pressable>
        <Pressable
          style={[s.btn, !canNext && s.btnDisabled]}
          onPress={onNext}
          disabled={!canNext}
          hitSlop={6}
        >
          <Text style={[s.btnText, !canNext && s.btnTextDisabled]}>Next</Text>
          <ChevronRight size={15} color={canNext ? '#2B6FD5' : '#9BAAC2'} />
        </Pressable>
        <Pressable
          style={[s.btn, !canNext && s.btnDisabled]}
          onPress={onLast}
          disabled={!canNext}
          hitSlop={6}
        >
          <Text style={[s.btnText, !canNext && s.btnTextDisabled]}>Last</Text>
          <ChevronsRight size={15} color={canNext ? '#2B6FD5' : '#9BAAC2'} />
        </Pressable>
      </View>
      <View style={s.infoRow}>
        <Text style={s.pageText}>Page {currentPage} of {totalPages}</Text>
        <Text style={s.dot}>•</Text>
        <Text style={s.countText}>{totalCount} {itemLabel}</Text>
        {loading && <ActivityIndicator accessibilityLabel="Loading" size="small" color="#2D5DC9" style={{ marginLeft: 6 }} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 14, paddingBottom: 8, gap: 10, alignItems: 'center' },
  buttonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, width: '100%' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 72,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D5E2F7',
    backgroundColor: '#EEF4FF',
  },
  btnDisabled: { backgroundColor: '#F3F5FA', borderColor: '#E6EAF2' },
  btnText: { fontSize: 13, fontWeight: '700', color: '#2B6FD5' },
  btnTextDisabled: { color: '#9BAAC2' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageText: { fontSize: 13, fontWeight: '700', color: '#3A3A4A' },
  dot: { fontSize: 13, color: '#B6BECF' },
  countText: { fontSize: 13, color: '#7A7A8C' },
});

export const PaginationControls = React.memo(PaginationControlsBase);
export default PaginationControls;
