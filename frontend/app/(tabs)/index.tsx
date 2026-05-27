import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  Star, Users, BookOpen, TrendingUp, Calendar,
  ChevronRight, Clock, Zap, CheckCircle,
  Hash, Type, Leaf, Palette, Trophy, PlayCircle,
  Target, Layers, BarChart2, ClipboardList, User,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { useStudentProfile } from '../../src/context/StudentProfileContext';
import QuizRenderer from '../../src/components/quiz/QuizRenderer';
import { SvgXml } from 'react-native-svg';

import { Colors, Radius, Shadow } from '../../src/theme';
import { GIRAFFE, OWL, BUTTERFLY, PENGUIN } from '../../src/assets/svgs';

// ── Types ─────────────────────────────────────────────────────────────────────
type IconComp = React.ComponentType<{ size: number; color: string }>;

type SubjectItem = {
  subject: string;
  Icon: IconComp;
  color: string;
  bg: string;
};

type Classroom = {
  id: string; title: string; classLevel: string;
  completionPct: number; status: string;
  contents: Array<{ id: string; title: string; subject?: string; contentType?: string }>;
  quizzes:  Array<{ id: string; title: string; totalQuestions: number; difficultyLevel?: string; status: string }>;
  assignments: Array<{ id: string; status: string }>;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CHILD_COLORS = [Colors.primary, Colors.success, Colors.accent, Colors.purple, Colors.warning];

const SUBJECT_ICON_MAP: Record<string, { Icon: IconComp; color: string; bg: string }> = {
  'Hindi Stories': { Icon: BookOpen, color: Colors.warning, bg: Colors.warningLight },
  'English':       { Icon: Type,     color: Colors.primary, bg: Colors.primaryLight  },
  'Maths':         { Icon: Hash,     color: Colors.success, bg: Colors.successLight  },
  'Science':       { Icon: Zap,      color: Colors.purple,  bg: Colors.purpleLight   },
  'Numbers':       { Icon: Hash,     color: Colors.accent,  bg: Colors.accentLight   },
  'Alphabets':     { Icon: Type,     color: Colors.primary, bg: Colors.primaryLight  },
  'Animals':       { Icon: Leaf,     color: Colors.success, bg: Colors.successLight  },
  'Colors':        { Icon: Palette,  color: Colors.purple,  bg: Colors.purpleLight   },
};
const FALLBACK_ICONS: IconComp[]  = [Hash, BookOpen, Leaf, Palette, Type, Zap, Star, Target];
const FALLBACK_COLORS = [Colors.accent, Colors.primary, Colors.success, Colors.purple, Colors.warning];
const FALLBACK_BGS    = [Colors.accentLight, Colors.primaryLight, Colors.successLight, Colors.purpleLight, Colors.warningLight];

const QUIZ_ICON_COMPS: IconComp[]  = [BookOpen, Zap, Star, Target];
const QUIZ_ICON_COLORS = [Colors.accent, Colors.purple, Colors.warning, Colors.primary];
const QUIZ_ICON_BGS    = [Colors.accentLight, Colors.purpleLight, Colors.warningLight, Colors.primaryLight];

const STATUS_COLOR: Record<string, string> = {
  completed: Colors.success,
  attempted: Colors.warning,
  pending:   Colors.textMuted,
};

const QUICK_ACTIONS = [
  { label: 'Reports',   Icon: BarChart2,  color: Colors.primary, bg: Colors.primaryLight, route: '/(tabs)/reports'   as const },
  { label: 'Classroom', Icon: BookOpen,   color: Colors.accent,  bg: Colors.accentLight,  route: '/(tabs)/classroom' as const },
  { label: 'Progress',  Icon: TrendingUp, color: Colors.success, bg: Colors.successLight, route: '/(tabs)/reports'   as const },
  { label: 'Schedule',  Icon: Calendar,   color: Colors.purple,  bg: Colors.purpleLight,  route: '/(tabs)/reports'   as const },
];

const DEFAULT_SUBJECTS: SubjectItem[] = [
  { subject: 'Numbers',   Icon: Hash,    color: Colors.accent,  bg: Colors.accentLight   },
  { subject: 'Alphabets', Icon: Type,    color: Colors.primary, bg: Colors.primaryLight  },
  { subject: 'Animals',   Icon: Leaf,    color: Colors.success, bg: Colors.successLight  },
  { subject: 'Colors',    Icon: Palette, color: Colors.purple,  bg: Colors.purpleLight   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function fmtSec(s: number) {
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m`;
}

function ActivityTypeIcon({ type, size = 16, color = Colors.textMuted }: {
  type: string; size?: number; color?: string;
}) {
  if (type === 'quiz') return <Layers size={size} color={color} />;
  if (type === 'assignment') return <ClipboardList size={size} color={color} />;
  return <BookOpen size={size} color={color} />;
}

// ── Parent Dashboard ──────────────────────────────────────────────────────────
function ParentDashboard() {
  const { user } = useAuth();
  const {
    linkedStudents, activeStudent,
    loadingStudents, loadingActivity,
    activity, analytics,
    switchToStudent, refreshAll,
  } = useStudentProfile();

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
          <View>
            <Text style={s.greetingSub}>{getGreeting()},</Text>
            <Text style={s.greetingName}>{user?.firstName ?? 'Parent'}</Text>
          </View>
        </View>

        {/* Child switcher */}
        <View style={s.profileSwitcherWrap}>
          <Text style={s.profileSwitcherLabel}>My Children</Text>
          {loadingStudents ? (
            <ActivityIndicator color={Colors.purple} size="small" style={{ marginTop: 8 }} />
          ) : linkedStudents.length === 0 ? (
            <View style={s.emptyBlock}>
              <SvgXml xml={PENGUIN} width={80} height={80} />
              <Text style={s.emptyTitle}>No children linked yet</Text>
              <Text style={s.emptyBody}>Ask your school admin to link your account.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.avatarScroll}
              contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              {linkedStudents.map((child, idx) => {
                const isActive   = child.id === activeStudent?.id;
                const chipColor  = CHILD_COLORS[idx % CHILD_COLORS.length];
                return (
                  <Pressable key={child.id} style={s.avatarItem} onPress={() => switchToStudent(child.id)}>
                    <View style={[s.avatarCircle, { backgroundColor: chipColor, borderWidth: isActive ? 3 : 0, borderColor: Colors.text }]}>
                      <User size={22} color="#fff" />
                    </View>
                    <Text style={[s.avatarName, isActive && { fontWeight: '900', color: Colors.text }]} numberOfLines={1}>
                      {child.firstName}
                    </Text>
                    {isActive && <View style={[s.avatarActiveDot, { backgroundColor: chipColor }]} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Active child detail */}
        {activeStudent && (
          <>
            <View style={s.activeChildHeader}>
              <View>
                <Text style={s.activeChildName}>{activeStudent.firstName} {activeStudent.lastName}</Text>
                <Text style={s.activeChildMeta}>
                  {activeStudent.classLevel ? `Class ${activeStudent.classLevel}` : 'No class assigned'}
                </Text>
              </View>
              <Pressable style={s.viewReportBtn} onPress={() => router.push('/(tabs)/reports')}>
                <Text style={s.viewReportBtnText}>Full Report</Text>
                <ChevronRight size={12} color="#fff" />
              </Pressable>
            </View>

            {/* Analytics strip */}
            {analytics?.summary && (
              <View style={s.statsStrip}>
                <View style={[s.statPill, { backgroundColor: Colors.primaryLight }]}>
                  <Zap size={13} color={Colors.primary} />
                  <Text style={[s.statPillVal, { color: Colors.primary }]}>{analytics.summary.streakDays}</Text>
                  <Text style={s.statPillLbl}>Streak</Text>
                </View>
                <View style={[s.statPill, { backgroundColor: Colors.successLight }]}>
                  <CheckCircle size={13} color={Colors.success} />
                  <Text style={[s.statPillVal, { color: Colors.success }]}>{analytics.summary.completionRate.toFixed(0)}%</Text>
                  <Text style={s.statPillLbl}>Done</Text>
                </View>
                <View style={[s.statPill, { backgroundColor: Colors.warningLight }]}>
                  <Star size={13} color={Colors.warning} fill={Colors.warning} />
                  <Text style={[s.statPillVal, { color: Colors.warning }]}>{analytics.summary.attemptedCount}</Text>
                  <Text style={s.statPillLbl}>Tried</Text>
                </View>
                <View style={[s.statPill, { backgroundColor: Colors.purpleLight }]}>
                  <Clock size={13} color={Colors.purple} />
                  <Text style={[s.statPillVal, { color: Colors.purple }]}>{fmtSec(analytics.summary.totalTimeSeconds)}</Text>
                  <Text style={s.statPillLbl}>Time</Text>
                </View>
              </View>
            )}

            {/* Breakdown */}
            {analytics?.breakdown && Object.keys(analytics.breakdown).length > 0 && (
              <>
                <View style={s.rowHeader}>
                  <Text style={s.rowTitle}>Activity Breakdown</Text>
                </View>
                <View style={s.breakdownRow}>
                  {Object.entries(analytics.breakdown).map(([type, data]) => (
                    <View key={type} style={[s.breakdownCard, { backgroundColor: Colors.surface }]}>
                      <ActivityTypeIcon type={type} size={22} color={Colors.primary} />
                      <Text style={s.breakdownCount}>{data.count}</Text>
                      <Text style={s.breakdownLabel}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                      {data.avgScore !== null && (
                        <Text style={s.breakdownScore}>avg {data.avgScore}%</Text>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Recent activity */}
            <View style={s.rowHeader}>
              <Text style={s.rowTitle}>Recent Activity</Text>
              <Pressable onPress={() => router.push('/(tabs)/reports')}>
                <Text style={s.rowLink}>See All</Text>
              </Pressable>
            </View>
            {loadingActivity ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : activity.length === 0 ? (
              <View style={s.emptyBlock}>
                <Text style={s.emptyTitle}>No activity yet</Text>
              </View>
            ) : (
              activity.slice(0, 6).map((item) => {
                const dotColor = STATUS_COLOR[item.status] ?? Colors.textMuted;
                return (
                  <View key={item.id} style={s.activityRow}>
                    <View style={[s.activityIconWrap, { backgroundColor: dotColor + '18' }]}>
                      <ActivityTypeIcon type={item.activityType} size={14} color={dotColor} />
                    </View>
                    <View style={s.activityInfo}>
                      <Text style={s.activityTitle} numberOfLines={1}>
                        {item.referenceTitle ?? item.activityType}
                      </Text>
                      <Text style={s.activityMeta}>
                        {item.status} · {item.activityDate}
                        {item.score !== undefined ? ` · ${item.score}%` : ''}
                      </Text>
                    </View>
                    {item.timeSpentSeconds > 0 && (
                      <Text style={s.activityTime}>{fmtSec(item.timeSpentSeconds)}</Text>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* Quick actions */}
        <View style={s.rowHeader}>
          <Text style={s.rowTitle}>Quick Actions</Text>
        </View>
        <View style={s.quickActionsGrid}>
          {QUICK_ACTIONS.map((qa) => (
            <Pressable key={qa.label} style={[s.quickActionTile, { backgroundColor: qa.bg }]} onPress={() => router.push(qa.route)}>
              <View style={[s.quickActionIcon, { backgroundColor: qa.color + '20' }]}>
                <qa.Icon size={22} color={qa.color} />
              </View>
              <Text style={[s.quickActionLabel, { color: qa.color }]}>{qa.label}</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user, apiFetch } = useAuth();
  const role = user?.activeRole ?? 'student';

  const [loading, setLoading]               = useState(true);
  const [classroom, setClassroom]           = useState<Classroom | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [subjects, setSubjects]             = useState<SubjectItem[]>([]);
  const [achievementGroups, setAchievementGroups] = useState<Array<{
    name: string; emoji: string; color: string; description: string; count: number;
  }>>([]);
  const [totalAchievements, setTotalAchievements] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    if (role === 'teacher' || role === 'admin' || role === 'superadmin') return;
    setLoading(true);
    try {
      if (role === 'student') {
        const [classroomsRes, subjectsRes, achievRes] = await Promise.all([
          apiFetch('/classrooms/student'),
          apiFetch('/students/subjects'),
          apiFetch('/achievements/my'),
        ]);
        if (achievRes.ok) {
          const ad = await achievRes.json();
          setTotalAchievements(ad.total ?? 0);
          setAchievementGroups(ad.achievements ?? []);
        }
        if (classroomsRes.ok) {
          const payload = await classroomsRes.json();
          const rooms   = (payload.classrooms ?? []) as Classroom[];
          setClassroom(rooms.find((r) => r.status === 'active') ?? rooms[0] ?? null);
        }
        if (subjectsRes.ok) {
          const payload = await subjectsRes.json();
          setSubjects(
            ((payload.subjects ?? []) as Array<{ subject: string }>).map((s, i) => {
              const mapped = SUBJECT_ICON_MAP[s.subject];
              return {
                subject: s.subject,
                Icon:    mapped?.Icon  ?? FALLBACK_ICONS[i % FALLBACK_ICONS.length],
                color:   mapped?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                bg:      mapped?.bg    ?? FALLBACK_BGS[i % FALLBACK_BGS.length],
              };
            }),
          );
        }
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [apiFetch, user, role]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const pending         = useMemo(() => classroom?.assignments.filter((a) => a.status !== 'submitted').length ?? 0, [classroom]);
  const xp              = Math.round((classroom?.completionPct ?? 0) * 15);
  const featured        = classroom?.contents?.[0] ?? null;
  const quizzes         = classroom?.quizzes?.slice(0, 4) ?? [];
  const displaySubjects = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;

  if (role === 'teacher') return <Redirect href="/(tabs)/planner" />;
  if (role === 'admin' || role === 'superadmin') return <Redirect href="/(tabs)/admin" />;
  if (role === 'parent') return <ParentDashboard />;

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── TOP BAR ─────────────────────────────────────── */}
        <View style={[s.topBar, { paddingTop: Platform.OS === 'ios' ? 2 : 8 }]}>
          <View>
            <Text style={s.greetingSub}>{getGreeting()},</Text>
            <Text style={s.greetingName}>{user?.firstName ?? 'Learner'}</Text>
          </View>
          <View style={s.xpChip}>
            <Star size={12} color="#F5C842" fill="#F5C842" />
            <Text style={s.xpLabel}>{xp > 0 ? xp.toLocaleString() : '1,200'}</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.loadingBlock}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={s.loadingLabel}>Loading your space…</Text>
          </View>
        ) : (
          <>
            {/* ── HERO BANNER ─────────────────────────────── */}
            <Pressable
              style={[s.heroBanner, !classroom && s.heroBannerPurple]}
              onPress={() => router.push('/(tabs)/classroom')}
            >
              <View style={s.heroLeft}>
                <Text style={s.heroSub}>{classroom ? 'Active Class' : 'Your Learning Space'}</Text>
                <Text style={s.heroTitle}>
                  {classroom ? classroom.title : 'Explore Classes'}
                </Text>
                <View style={s.heroBtn}>
                  <Text style={s.heroBtnText}>{classroom ? 'Join Now' : 'Explore'}</Text>
                  <ChevronRight size={14} color="#fff" />
                </View>
              </View>
              <View style={s.heroAvatar}>
                {classroom
                  ? <Users size={26} color="rgba(255,255,255,0.9)" />
                  : <BookOpen size={26} color="rgba(255,255,255,0.9)" />}
              </View>
            </Pressable>

            {/* ── SUBJECTS ────────────────────────────────── */}
            <View style={s.rowHeader}>
              <Text style={s.rowTitle}>Subjects</Text>
              <Pressable onPress={() => router.push('/(tabs)/subject')}>
                <Text style={s.rowLink}>See All</Text>
              </Pressable>
            </View>
            <View style={s.tilesGrid}>
              {displaySubjects.map((tile, i) => (
                <Pressable
                  key={i}
                  style={[s.tile, { backgroundColor: tile.bg }]}
                  onPress={() => router.push({ pathname: '/(tabs)/subject', params: { subject: tile.subject } })}
                >
                  <View style={[s.tileIconWrap, { backgroundColor: tile.color + '20' }]}>
                    <tile.Icon size={28} color={tile.color} />
                  </View>
                  <Text style={[s.tileLabel, { color: tile.color }]}>{tile.subject}</Text>
                </Pressable>
              ))}
            </View>


            {/* ── FEATURED STORY ──────────────────────────── */}
            <Text style={s.secTitle}>Featured Story</Text>
            <Pressable style={s.storyCard} onPress={() => router.push('/(tabs)/classroom')}>
              <View style={s.storyLeft}>
                <Text style={s.storyTitle}>
                  {featured?.title ?? 'Story Of\nBaby Dinosaur'}
                </Text>
                <View style={s.storyMeta}>
                  <Clock size={11} color={Colors.textMuted} />
                  <Text style={s.storyMetaText}>15 Minutes · 22 Aug</Text>
                </View>
                <View style={s.storyPlayBtn}>
                  <PlayCircle size={14} color="#fff" />
                  <Text style={s.storyPlayText}>Play Now</Text>
                </View>
              </View>
              <View style={s.storyIllustration}>
                <SvgXml xml={GIRAFFE} width={80} height={80} />
              </View>
            </Pressable>

            {/* ── GAMES / QUIZZES ─────────────────────────── */}
            {quizzes.length > 0 && (
              <>
                <View style={s.rowHeader}>
                  <Text style={s.rowTitle}>Games</Text>
                  <Pressable onPress={() => router.push('/(tabs)/classroom')}>
                    <Text style={s.rowLink}>See All</Text>
                  </Pressable>
                </View>
                {quizzes.map((quiz, idx) => {
                  const QuizIcon  = QUIZ_ICON_COMPS[idx % QUIZ_ICON_COMPS.length];
                  const iconColor = QUIZ_ICON_COLORS[idx % QUIZ_ICON_COLORS.length];
                  const iconBg    = QUIZ_ICON_BGS[idx % QUIZ_ICON_BGS.length];
                  return (
                    <Pressable key={quiz.id} style={s.gameCard} onPress={() => setSelectedQuizId(quiz.id)}>
                      <View style={[s.gameIconBox, { backgroundColor: iconBg }]}>
                        <QuizIcon size={24} color={iconColor} />
                      </View>
                      <View style={s.gameInfo}>
                        <Text style={s.gameTitle}>{quiz.title}</Text>
                        <Text style={s.gameSub}>{quiz.totalQuestions} levels · {quiz.difficultyLevel ?? 'Standard'}</Text>
                      </View>
                      <View style={[s.gamePlayBtn, { backgroundColor: iconColor }]}>
                        <Text style={s.gamePlayText}>{quiz.status === 'completed' ? 'Replay' : 'Play'}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}

            {/* ── PROGRESS ────────────────────────────────── */}
            {classroom && (
              <View style={s.progressCard}>
                <View style={s.progressRow}>
                  <Text style={s.progressLabel}>Classroom Progress</Text>
                  <Text style={s.progressPct}>{classroom.completionPct ?? 0}%</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${Math.min(100, classroom.completionPct ?? 0)}%` }]} />
                </View>
                <View style={s.progressStats}>
                  <View style={s.progressStat}>
                    <Text style={[s.progressStatVal, { color: Colors.primary }]}>{classroom.contents?.length ?? 0}</Text>
                    <Text style={s.progressStatLabel}>Content</Text>
                  </View>
                  <View style={s.progressDivider} />
                  <View style={s.progressStat}>
                    <Text style={[s.progressStatVal, { color: Colors.accent }]}>{classroom.quizzes?.length ?? 0}</Text>
                    <Text style={s.progressStatLabel}>Quizzes</Text>
                  </View>
                  <View style={s.progressDivider} />
                  <View style={s.progressStat}>
                    <Text style={[s.progressStatVal, { color: Colors.success }]}>{pending}</Text>
                    <Text style={s.progressStatLabel}>Pending</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── ACHIEVEMENTS ────────────────────────────── */}
            {achievementGroups.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionTitleRow}>
                    <Trophy size={16} color={Colors.warning} />
                    <Text style={s.sectionTitle}>My Achievements</Text>
                  </View>
                  <View style={s.achievBadge}>
                    <Text style={s.achievBadgeText}>{totalAchievements} total</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 4 }}>
                  {achievementGroups.map((ag, i) => (
                    <View key={i} style={[s.achievCard, { backgroundColor: `${ag.color}15`, borderColor: `${ag.color}40`, borderWidth: 1.5 }]}>
                      <Text style={s.achievEmoji}>{ag.emoji}</Text>
                      {ag.count > 1 && (
                        <View style={[s.achievCountBadge, { backgroundColor: ag.color }]}>
                          <Text style={s.achievCountText}>×{ag.count}</Text>
                        </View>
                      )}
                      <Text style={[s.achievName, { color: ag.color }]}>{ag.name}</Text>
                      {ag.description ? <Text style={s.achievDesc} numberOfLines={2}>{ag.description}</Text> : null}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── EMPTY STATE ─────────────────────────────── */}
            {!classroom && (
              <View style={s.emptyBlock}>
                <SvgXml xml={OWL} width={90} height={90} />
                <Text style={s.emptyTitle}>No classroom yet</Text>
                <Text style={s.emptyBody}>Your teacher will add you to a class soon!</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {selectedQuizId && (
        <QuizRenderer
          quizId={selectedQuizId}
          visible
          onClose={() => { setSelectedQuizId(null); loadData(); }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 48 },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.surface,
  },
  greetingSub:  { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  greetingName: { fontSize: 22, color: Colors.text, fontWeight: '900', lineHeight: 28 },
  xpChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  xpLabel: { fontSize: 13, fontWeight: '800', color: '#fff' },


  // ── Row headers ──────────────────────────────────────────────────────────
  rowHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  rowTitle: { fontSize: 17, fontWeight: '900', color: Colors.text },
  rowLink:  { fontSize: 13, fontWeight: '700', color: Colors.primary },
  secTitle: { fontSize: 17, fontWeight: '900', color: Colors.text, paddingHorizontal: 20, marginBottom: 12 },

  // ── Hero banner ──────────────────────────────────────────────────────────
  heroBanner: {
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: Colors.primary, borderRadius: Radius.xxl,
    paddingVertical: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...Shadow.md,
    shadowColor: Colors.primary,
  },
  heroBannerPurple: { backgroundColor: Colors.purple, shadowColor: Colors.purple },
  heroLeft:  { flex: 1, paddingRight: 8 },
  heroSub:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginBottom: 4 },
  heroTitle: { fontSize: 20, color: '#fff', fontWeight: '900', lineHeight: 26, marginBottom: 14 },
  heroBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  heroBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  heroAvatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Subject tiles ─────────────────────────────────────────────────────────
  tilesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, paddingHorizontal: 16, marginBottom: 24,
  },
  tile: {
    width: '47%', borderRadius: Radius.xl,
    paddingVertical: 20, paddingHorizontal: 14,
    alignItems: 'center', gap: 10,
    ...Shadow.sm,
  },
  tileIconWrap: {
    width: 54, height: 54, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  tileLabel: { fontSize: 14, fontWeight: '800' },

  // ── Story card ───────────────────────────────────────────────────────────
  storyCard: {
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: '#FFFDE7', borderRadius: Radius.xl,
    padding: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    ...Shadow.sm,
  },
  storyLeft:          { flex: 1, paddingRight: 12 },
  storyTitle:         { fontSize: 16, fontWeight: '900', color: Colors.text, lineHeight: 22, marginBottom: 6 },
  storyMeta:          { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  storyMetaText:      { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  storyPlayBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  storyPlayText:      { fontSize: 12, fontWeight: '800', color: '#fff' },
  storyIllustration:  { width: 70, alignItems: 'center', justifyContent: 'center' },

  // ── Game cards ───────────────────────────────────────────────────────────
  gameCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, marginHorizontal: 16, marginBottom: 10,
    borderRadius: Radius.lg, padding: 14, gap: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  gameIconBox:  { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  gameInfo:     { flex: 1 },
  gameTitle:    { fontSize: 14, fontWeight: '800', color: Colors.text, marginBottom: 3 },
  gameSub:      { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
  gamePlayBtn:  { borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  gamePlayText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  // ── Progress card ────────────────────────────────────────────────────────
  progressCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 16, borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  progressRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel:     { fontSize: 13, fontWeight: '800', color: Colors.text },
  progressPct:       { fontSize: 13, fontWeight: '900', color: Colors.primary },
  progressTrack:     { height: 8, backgroundColor: Colors.borderLight, borderRadius: Radius.full, overflow: 'hidden', marginBottom: 14 },
  progressFill:      { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.primary },
  progressStats:     { flexDirection: 'row', justifyContent: 'space-around' },
  progressStat:      { alignItems: 'center', gap: 2 },
  progressStatVal:   { fontSize: 20, fontWeight: '900', color: Colors.text },
  progressStatLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  progressDivider:   { width: 1, backgroundColor: Colors.borderLight, alignSelf: 'stretch' },

  // ── Loading / empty ──────────────────────────────────────────────────────
  loadingBlock: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  emptyBlock:   { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  emptyBody:    { fontSize: 13, fontWeight: '500', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // ── Achievements ─────────────────────────────────────────────────────────
  section:         { marginBottom: 20 },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle:    { fontSize: 16, fontWeight: '900', color: Colors.text },
  achievBadge:     { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  achievBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  achievCard:      { width: 130, borderRadius: Radius.lg, padding: 14, alignItems: 'center', gap: 6 },
  achievEmoji:     { fontSize: 36 },
  achievCountBadge:{ position: 'absolute', top: 6, right: 6, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  achievCountText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  achievName:      { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  achievDesc:      { fontSize: 10, color: Colors.textMuted, textAlign: 'center', lineHeight: 14 },

  // ── Parent-specific ──────────────────────────────────────────────────────
  profileSwitcherWrap:  { marginHorizontal: 16, marginBottom: 4, marginTop: 4 },
  profileSwitcherLabel: { fontSize: 12, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4, marginLeft: 2 },
  avatarScroll:         { marginHorizontal: -16 },
  avatarItem:           { alignItems: 'center', gap: 4, width: 64 },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  avatarName:      { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  avatarActiveDot: { width: 8, height: 8, borderRadius: 4 },

  activeChildHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  activeChildName:    { fontSize: 18, fontWeight: '900', color: Colors.text },
  activeChildMeta:    { fontSize: 12, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  viewReportBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  viewReportBtnText:  { fontSize: 12, fontWeight: '800', color: '#fff' },

  statsStrip:  { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  statPill:    { flex: 1, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  statPillVal: { fontSize: 15, fontWeight: '900' },
  statPillLbl: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },

  breakdownRow:   { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 8 },
  breakdownCard:  { flex: 1, borderRadius: Radius.lg, padding: 12, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.sm },
  breakdownCount: { fontSize: 20, fontWeight: '900', color: Colors.text },
  breakdownLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  breakdownScore: { fontSize: 10, fontWeight: '700', color: Colors.success, marginTop: 2 },

  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12,
    ...Shadow.sm,
  },
  activityIconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activityInfo:     { flex: 1, gap: 2 },
  activityTitle:    { fontSize: 13, fontWeight: '700', color: Colors.text },
  activityMeta:     { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  activityTime:     { fontSize: 11, fontWeight: '700', color: Colors.primary },

  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  quickActionTile:  { width: '47%', borderRadius: Radius.xl, paddingVertical: 18, paddingHorizontal: 14, alignItems: 'center', gap: 8, ...Shadow.sm },
  quickActionIcon:  { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 13, fontWeight: '800' },

  logicoCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: Radius.xl,
    backgroundColor: '#4A90E2',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadow.sm,
  },
  logicoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  logicoCardTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  logicoCardSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2 },
});
