import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import {
    CheckCircle2, User, Mail, Save, Loader2
} from 'lucide-react';

export const Profile: React.FC = () => {
    const { user, profile } = useAuth();
    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [phone, setPhone] = useState(profile?.phone || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name);
            setPhone(profile.phone || '');
            setBio(profile.bio || '');
            setAvatarUrl(profile.avatar_url || '');
        }
    }, [profile]);

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            const file = event.target.files?.[0];
            if (!file || !user) return;

            // 1. Validate file (optional but good)
            if (file.size > 2 * 1024 * 1024) {
                alert('File is too large. Max 2MB.');
                return;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            // Use folder structure: user_id/filename
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                throw new Error(uploadError.message || 'Failed to upload to storage');
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            if (!publicUrl) throw new Error('Could not generate public URL');

            setAvatarUrl(publicUrl);

            const { error: updateError } = await supabase.from('profiles').update({
                avatar_url: publicUrl
            }).eq('id', user.id);

            if (updateError) {
                console.error('Profile update error:', updateError);
                throw new Error('Failed to update profile with new image');
            }

        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            alert(`Avatar Upload Error: ${error.message}\n\nNote: Please ensure the "avatars" bucket is created in Supabase.`);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setSaved(false);

        await supabase.from('profiles').update({
            full_name: fullName,
            phone,
            bio,
            avatar_url: avatarUrl
        }).eq('id', user.id);

        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    if (!profile) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <User className="w-6 h-6 text-accent-primary" />
                My Profile
            </h1>

            {/* Profile Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative group">
                            <Avatar src={avatarUrl} name={fullName || 'User'} size="xl" />
                            <label
                                htmlFor="avatar-upload"
                                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                {uploading ? (
                                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                                ) : (
                                    <span className="text-white text-xs font-medium">Change</span>
                                )}
                            </label>
                            <input
                                id="avatar-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                        </div>
                        <Badge
                            variant={profile.role === 'fulltime' ? 'success' : profile.role === 'admin' ? 'default' : 'warning'}
                            className="mt-4 capitalize"
                        >
                            {profile.role}
                        </Badge>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-hover/50 border border-border-default">
                            <Mail className="w-4 h-4 text-text-muted shrink-0" />
                            <span className="text-sm text-text-secondary">{profile.email}</span>
                        </div>

                        <Input
                            label="Full Name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Your name..."
                        />

                        <Input
                            label="Phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+94 77 XXX XXXX"
                        />

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                Job Role
                            </label>
                            <textarea
                                className="flex w-full rounded-xl border border-border-default bg-white/[0.03] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary/50 transition-all duration-200 min-h-[100px] resize-none"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="e.g. Senior Photographer, Editor"
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <Button onClick={handleSave} isLoading={saving} className="flex-1">
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </Button>
                            {saved && (
                                <span className="text-sm text-emerald-400 font-medium animate-fade-in flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" /> Saved!
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
