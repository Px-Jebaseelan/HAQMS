'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/common/Navbar';
import {
  ArrowLeft, ClipboardList, FileText, Activity, AlertCircle,
  Phone, Mail, User2, CalendarDays, Clock
} from 'lucide-react';

export default function PatientHistoryRecords() {
  const { id } = useParams();
  const router = useRouter();
  const { user, token, API_BASE_URL } = useAuth();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  useEffect(() => {
    if (!user) { router.push('/login'); }
  }, [user, router]);

  useEffect(() => {
    if (!user || !token) return;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/patients/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load patient record');
        if (isMounted.current) setPatient(data.patient ?? data);
      } catch (e) {
        if (isMounted.current) setError(e.message);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    })();
  }, [id, token, API_BASE_URL, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 sm:p-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-20">
            <div className="pulse-loader"><div></div><div></div></div>
            <p className="mt-4 text-sm font-semibold text-slate-400 animate-pulse">Loading clinical record…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="glass p-6 rounded-2xl border border-rose-500/20 shadow-md flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-500">Failed to load record</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && patient && (
          <div className="space-y-8">

            {/* Patient header card */}
            <div className="glass p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl shrink-0">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{patient.name}</h1>
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mt-1">
                    Diagnostic Records — Legacy App
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard icon={<User2 className="h-4 w-4" />}    label="Age / Sex"   value={`${patient.age} yrs · ${patient.gender}`} />
                <InfoCard icon={<Phone className="h-4 w-4" />}    label="Phone"        value={patient.phoneNumber} />
                <InfoCard icon={<Mail className="h-4 w-4" />}     label="Email"        value={patient.email || '—'} />
                <InfoCard icon={<Activity className="h-4 w-4" />} label="Patient ID"   value={patient.id} mono />
              </div>
            </div>

            {/* Medical anamnesis */}
            <SectionCard icon={<FileText className="h-5 w-5 text-teal-600" />} title="Medical Anamnesis">
              {patient.medicalHistory ? (
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-6 whitespace-pre-wrap">
                  {patient.medicalHistory}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">No recorded medical history on file for this patient.</p>
              )}
            </SectionCard>

            {/* Appointment history */}
            <SectionCard
              icon={<CalendarDays className="h-5 w-5 text-teal-600" />}
              title={`Appointment History (${patient.appointments?.length ?? 0})`}
            >
              {patient.appointments?.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-widest text-xxs font-bold border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-3 text-left pr-4">Date &amp; Time</th>
                        <th className="pb-3 text-left pr-4">Physician</th>
                        <th className="pb-3 text-left pr-4">Reason</th>
                        <th className="pb-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {patient.appointments.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-500/5 transition-colors">
                          <td className="py-3.5 font-mono text-xs pr-4 text-slate-700 dark:text-slate-300">
                            {new Date(a.appointmentDate).toLocaleString()}
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {a.doctor?.name ?? '—'}
                            </span>
                            {a.doctor?.specialization && (
                              <span className="block text-xxs text-teal-600 dark:text-teal-400 uppercase font-semibold">
                                {a.doctor.specialization}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 pr-4 text-slate-500 dark:text-slate-400 text-xs">
                            {a.reason || '—'}
                          </td>
                          <td className="py-3.5">
                            <StatusPill status={a.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState label="No prior appointments on record." />
              )}
            </SectionCard>

            {/* Queue token history */}
            <SectionCard
              icon={<Clock className="h-5 w-5 text-teal-600" />}
              title={`Recent Queue Activity (${patient.queueTokens?.length ?? 0})`}
            >
              {patient.queueTokens?.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {patient.queueTokens.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-500/5 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xl font-black text-slate-800 dark:text-slate-100">
                          Token #{t.tokenNumber}
                        </span>
                        <StatusPill status={t.status} />
                      </div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.doctor?.name ?? '—'}
                      </p>
                      <p className="text-xxs text-slate-400">
                        {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="No queue history found." />
              )}
            </SectionCard>

          </div>
        )}
      </main>
    </div>
  );
}

function InfoCard({ icon, label, value, mono }) {
  return (
    <div className="p-3 rounded-xl bg-slate-500/5 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-1.5 text-slate-400 text-xxs uppercase font-bold tracking-widest mb-1">
        {icon}
        {label}
      </div>
      <p className={`font-bold text-slate-800 dark:text-slate-100 break-all ${mono ? 'font-mono text-xs' : 'text-sm'}`}>
        {value}
      </p>
    </div>
  );
}

function SectionCard({ icon, title, children }) {
  return (
    <div className="glass p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
      <h2 className="text-lg font-extrabold flex items-center gap-2 mb-5 text-slate-800 dark:text-slate-100">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyState({ label }) {
  return <p className="text-sm italic text-slate-400">{label}</p>;
}

function StatusPill({ status }) {
  const styles = {
    PENDING:   'bg-amber-500/10 text-amber-500',
    CONFIRMED: 'bg-blue-500/10 text-blue-500',
    COMPLETED: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    CANCELLED: 'bg-rose-500/10 text-rose-500',
    WAITING:   'bg-amber-500/10 text-amber-500',
    CALLING:   'bg-teal-500 text-white',
    SKIPPED:   'bg-rose-500/10 text-rose-500',
  };
  const cls = styles[status] || 'bg-slate-500/10 text-slate-500';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-extrabold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}
