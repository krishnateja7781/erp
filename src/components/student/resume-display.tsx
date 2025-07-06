
'use client';

import * as React from 'react';
import { Mail, Phone, Linkedin, Github, UserPlus, Trash2, MapPin, Award } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import type { Control } from 'react-hook-form';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormControl } from '../ui/form';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import type { ResumeFormValues } from '@/app/(app)/student/resume/page';
import { Badge } from '../ui/badge';


export interface StudentResumeData {
  name?: string;
  role?: string;
  photoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  linkedIn?: string;
  github?: string;
  objective?: string;
  education?: { degree: string; institution: string; year?: string; cgpa?: string; }[];
  skills?: { value: string }[];
  projects?: { title: string; description?: string; technologies?: string; }[];
  achievements?: { value: string }[];
}

interface ResumeDisplayProps {
  control: Control<ResumeFormValues>;
  showPhoto?: boolean;
  templateId: string;
}

const ResumeInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>((props, ref) => (
    <Input ref={ref} {...props} className={cn("p-0 h-auto bg-transparent border-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm px-1", props.className)} />
));
ResumeInput.displayName = "ResumeInput";

const ResumeTextarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<typeof Textarea>>((props, ref) => (
    <Textarea ref={ref} {...props} className={cn("p-1 w-full bg-transparent border-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm text-sm", props.className)} />
));
ResumeTextarea.displayName = "ResumeTextarea";

export const ResumeDisplay = React.forwardRef<HTMLDivElement, ResumeDisplayProps>(
  ({ control, showPhoto = true, templateId }, ref) => {
    
    const { watch } = useFormContext<ResumeFormValues>();
    const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({ control, name: "education" });
    const { fields: skillFields, append: appendSkill, remove: removeSkill } = useFieldArray({ control, name: "skills" });
    const { fields: projectFields, append: appendProject, remove: removeProject } = useFieldArray({ control, name: "projects" });
    const { fields: achievementFields, append: appendAchievement, remove: removeAchievement } = useFieldArray({ control, name: "achievements" });
    const name = watch('name');

    const getInitials = (name?: string): string => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    // --- SHARED COMPONENTS ---
    const PhotoSection = ({className}: {className?: string}) => (
      showPhoto ? (
        <FormField control={control} name="photoUrl" render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="relative group mx-auto">
                <Avatar className={cn("border-2 border-primary cursor-pointer h-24 w-24", className)}>
                  <AvatarImage src={field.value || undefined} alt={name || 'User'} data-ai-hint="student photo" />
                  <AvatarFallback className="text-3xl">{getInitials(name)}</AvatarFallback>
                </Avatar>
                <Input type="text" placeholder="Image URL" {...field} className="absolute bottom-0 left-0 w-full text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white"/>
              </div>
            </FormControl>
          </FormItem>
        )} />
      ) : null
    );

    const ContactInfo = ({ layout = 'row' }: { layout?: 'row' | 'col' }) => (
        <div className={cn(
            "flex text-xs",
            layout === 'row' ? "flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1" : "flex-col items-start gap-2"
        )}>
            <div className="flex items-center gap-1"><Phone className="h-3 w-3" /><FormField control={control} name="phone" render={({ field }) => <ResumeInput placeholder="Phone" {...field} />} /></div>
            <div className="flex items-center gap-1"><Mail className="h-3 w-3" /><FormField control={control} name="email" render={({ field }) => <ResumeInput placeholder="Email" {...field} />} /></div>
            <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /><FormField control={control} name="address" render={({ field }) => <ResumeInput placeholder="City, Country" {...field} />} /></div>
            <div className="flex items-center gap-1"><Linkedin className="h-3 w-3" /><FormField control={control} name="linkedIn" render={({ field }) => <ResumeInput placeholder="linkedin.com/in/..." {...field} />} /></div>
            <div className="flex items-center gap-1"><Github className="h-3 w-3" /><FormField control={control} name="github" render={({ field }) => <ResumeInput placeholder="github.com/..." {...field} />} /></div>
        </div>
    );
    
    const EducationSection = () => (
         <ResumeSection title="Education" onAdd={() => appendEdu({ degree: "", institution: "", year: "", cgpa: "" })}>
            {eduFields.map((field, index) => (
                <div key={field.id} className="mb-2 last:mb-0 group relative">
                    <FormField control={control} name={`education.${index}.degree`} render={({ field }) => <ResumeInput placeholder="Degree" {...field} className="text-md font-bold" />} />
                    <FormField control={control} name={`education.${index}.institution`} render={({ field }) => <ResumeInput placeholder="Institution" {...field} className="italic text-sm"/>} />
                    <div className="flex justify-between items-baseline text-xs">
                         <FormField control={control} name={`education.${index}.year`} render={({ field }) => <ResumeInput placeholder="Year" {...field} />} /> 
                         <FormField control={control} name={`education.${index}.cgpa`} render={({ field }) => <ResumeInput placeholder="CGPA" {...field} className="font-semibold text-right"/>} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEdu(index)} className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive"/></Button>
                </div>
            ))}
        </ResumeSection>
    );

     const SkillsSection = () => (
        <ResumeSection title="Skills" onAdd={() => appendSkill({ value: "" })}>
            <div className="flex flex-wrap gap-1">
                {skillFields.map((field, index) => (
                    <div key={field.id} className="group relative">
                        <FormField control={control} name={`skills.${index}.value`} render={({ field }) => <Badge variant="secondary" className="hover:bg-accent"><ResumeInput placeholder="Skill" {...field} className="text-sm px-1" /></Badge>} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeSkill(index)} className="absolute -top-2 -right-2 h-4 w-4 opacity-0 group-hover:opacity-100 bg-destructive/80 text-destructive-foreground hover:bg-destructive rounded-full"><Trash2 className="h-2 w-2"/></Button>
                    </div>
                ))}
            </div>
        </ResumeSection>
    );

    const ProjectsSection = () => (
        <ResumeSection title="Projects" onAdd={() => appendProject({ title: "", description: "", technologies: "" })}>
            {projectFields.map((field, index) => (
              <div key={field.id} className="mb-3 last:mb-0 group relative">
                <FormField control={control} name={`projects.${index}.title`} render={({ field }) => <ResumeInput placeholder="Project Title" {...field} className="text-md font-bold"/>} />
                <FormField control={control} name={`projects.${index}.description`} render={({ field }) => <ResumeTextarea placeholder="Describe the project..." {...field} />} />
                <div className="flex items-center text-xs gap-1"><span className="font-semibold">Technologies:</span><FormField control={control} name={`projects.${index}.technologies`} render={({ field }) => <ResumeInput placeholder="React, Node.js" {...field} />} /></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeProject(index)} className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive"/></Button>
              </div>
            ))}
        </ResumeSection>
    );
    
    const AchievementsSection = () => (
        <ResumeSection title="Achievements" onAdd={() => appendAchievement({ value: "" })}>
            <ul className="list-disc list-inside text-sm space-y-1">
                {achievementFields.map((field, index) => (
                <li key={field.id} className="group relative">
                    <FormField control={control} name={`achievements.${index}.value`} render={({ field }) => <ResumeInput placeholder="e.g., Won hackathon..." {...field} className="w-11/12"/>} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAchievement(index)} className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive"/></Button>
                </li>
                ))}
            </ul>
        </ResumeSection>
    );
    
    // --- TEMPLATE RENDERERS ---
    const renderModernSidebar = () => (
      <div className="font-sans">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <aside className="md:col-span-1 bg-primary/5 p-6 rounded-lg">
            <PhotoSection className="h-28 w-28"/>
            <div className="mt-6 space-y-4">
              <ResumeSection title="Contact" onAdd={() => {}} showAdd={false}> <ContactInfo layout="col"/> </ResumeSection>
              <EducationSection />
              <SkillsSection />
              <AchievementsSection />
            </div>
          </aside>
          <main className="md:col-span-2 py-6">
            <header className="mb-6 text-left">
              <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-4xl font-bold tracking-wider uppercase" />} />
              <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role / Title" {...field} className="text-xl text-primary font-semibold" />} />
            </header>
            <ResumeSection title="Objective" onAdd={() => {}} showAdd={false}>
                <FormField control={control} name="objective" render={({ field }) => <ResumeTextarea placeholder="A brief statement about your career goals..." {...field} className="italic"/>} />
            </ResumeSection>
            <ProjectsSection />
          </main>
        </div>
      </div>
    );
    
    const renderModernHeader = () => (
        <div className="font-sans">
            <header className="bg-primary/10 p-6 rounded-lg mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-4xl font-bold tracking-wider" />} />
                        <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role / Title" {...field} className="text-xl text-primary font-semibold" />} />
                    </div>
                    <PhotoSection className="h-24 w-24"/>
                </div>
                <div className="mt-4"><ContactInfo layout="row"/></div>
            </header>
            <main className="space-y-4">
                <ResumeSection title="Objective" onAdd={() => {}} showAdd={false}><FormField control={control} name="objective" render={({ field }) => <ResumeTextarea placeholder="Your career objective..." {...field} />} /></ResumeSection>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2"><ProjectsSection /></div>
                    <div className="md:col-span-1 space-y-4"><EducationSection /><SkillsSection /><AchievementsSection /></div>
                </div>
            </main>
        </div>
    );
    
    const renderModernIconic = () => (
        <div className="font-sans">
             <header className="mb-6 text-left border-b-2 border-primary/20 pb-4">
                <div className="flex items-center gap-4">
                    <PhotoSection className="h-20 w-20"/>
                    <div>
                        <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-3xl font-bold" />} />
                        <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role / Title" {...field} className="text-lg text-primary" />} />
                    </div>
                </div>
            </header>
             <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="md:col-span-2 space-y-4">
                     <ResumeSection title="Objective" onAdd={() => {}} showAdd={false}><FormField control={control} name="objective" render={({ field }) => <ResumeTextarea placeholder="A brief statement about your career goals..." {...field} />} /></ResumeSection>
                     <ProjectsSection />
                     <AchievementsSection />
                 </div>
                 <div className="md:col-span-1 space-y-4">
                     <ResumeSection title="Contact" onAdd={() => {}} showAdd={false}> <ContactInfo layout="col"/> </ResumeSection>
                     <EducationSection />
                     <SkillsSection />
                 </div>
             </main>
        </div>
    );
    
    const renderModernMinimalist = () => (
        <div className="font-sans">
             <header className="text-center mb-6">
                <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-4xl font-extralight tracking-widest uppercase text-center" />} />
                <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role / Title" {...field} className="text-md text-primary tracking-wider text-center" />} />
            </header>
             <main className="space-y-6">
                <div className="mx-auto w-fit"><ContactInfo layout="row" /></div>
                <div className="my-4 border-t border-muted-foreground/20"></div>
                <ResumeSection title="Objective" onAdd={() => {}} showAdd={false} className="border-none text-center"><FormField control={control} name="objective" render={({ field }) => <ResumeTextarea placeholder="A brief statement..." {...field} className="italic text-center"/>} /></ResumeSection>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4"><EducationSection /><ProjectsSection /></div>
                    <div className="space-y-4"><SkillsSection /><AchievementsSection /></div>
                </div>
            </main>
        </div>
    );

    const renderClassicProfessional = () => (
      <div className="font-serif">
        <header className="text-center mb-6 pb-4 border-b-2 border-primary">
          <PhotoSection />
          <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-4xl font-bold tracking-wider uppercase text-center" />} />
          <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role / Title" {...field} className="text-lg text-primary font-semibold text-center" />} />
          <div className="flex justify-center mt-2"><ContactInfo layout="row"/></div>
        </header>
        <main className="space-y-4">
          <ResumeSection title="Objective" onAdd={() => {}} showAdd={false}><FormField control={control} name="objective" render={({ field }) => <ResumeTextarea placeholder="A brief statement..." {...field} className="italic text-center"/>} /></ResumeSection>
          <EducationSection />
          <SkillsSection />
          <ProjectsSection />
          <AchievementsSection />
        </main>
      </div>
    );

    const renderClassicAcademic = () => (
        <div className="font-serif">
            <header className="mb-4">
                 <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-3xl font-bold" />} />
                 <ContactInfo layout="row" />
            </header>
            <main className="space-y-4">
                <ResumeSection title="Objective" onAdd={() => {}} showAdd={false}><FormField control={control} name="objective" render={({ field }) => <ResumeTextarea placeholder="A brief statement..." {...field} />} /></ResumeSection>
                <EducationSection />
                <ProjectsSection />
                <AchievementsSection />
                <SkillsSection />
            </main>
        </div>
    );

    const renderClassicTimeless = () => (
        <div className="font-['Georgia',_serif]">
            <header className="text-center mb-4 pb-4 border-b border-double border-gray-400">
                <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-4xl font-bold tracking-widest text-center" />} />
                <ContactInfo layout="row"/>
            </header>
             <main className="space-y-4">
                <ResumeSection title="Education" onAdd={() => appendEdu({ degree: "", institution: "", year: "", cgpa: "" })} className="text-center border-none" />
                {eduFields.map((field, index) => (
                    <div key={field.id} className="mb-2 text-center group relative">
                        <FormField control={control} name={`education.${index}.degree`} render={({ field }) => <ResumeInput placeholder="Degree" {...field} className="text-md font-bold" />} />
                        <div className="flex justify-center items-baseline text-xs"><FormField control={control} name={`education.${index}.institution`} render={({ field }) => <ResumeInput placeholder="Institution" {...field} className="italic"/>} />, <FormField control={control} name={`education.${index}.year`} render={({ field }) => <ResumeInput placeholder="Year" {...field} />} /></div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEdu(index)} className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive"/></Button>
                    </div>
                ))}
                <ProjectsSection />
                <SkillsSection />
                <AchievementsSection />
             </main>
        </div>
    );

    const renderClassicExecutive = () => (
        <div className="font-sans">
             <header className="mb-4 p-4 bg-primary/80 text-primary-foreground rounded-md">
                <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-3xl font-bold tracking-wide" />} />
                <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role" {...field} className="text-lg font-light" />} />
            </header>
             <main className="space-y-4 p-4">
                 <ContactInfo layout="row"/>
                 <div className="my-4 border-t border-muted-foreground/20"></div>
                 <ProjectsSection />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <EducationSection />
                    <SkillsSection />
                 </div>
                 <AchievementsSection />
             </main>
        </div>
    );
    
    const renderCompactTwoColumn = () => (
      <div className="font-sans text-sm">
        <header className="mb-4 text-center">
            <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-3xl font-bold" />} />
            <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role" {...field} className="text-md text-primary font-semibold" />} />
            <ContactInfo layout="row" />
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <main className="md:col-span-2 space-y-4">
                <ResumeSection title="Objective" onAdd={() => {}} showAdd={false}><FormField control={control} name="objective" render={({ field }) => <ResumeTextarea placeholder="Your career objective..." {...field} />} /></ResumeSection>
                <ProjectsSection />
            </main>
            <aside className="md:col-span-1 space-y-4">
                <PhotoSection />
                <EducationSection />
                <SkillsSection />
                <AchievementsSection />
            </aside>
        </div>
      </div>
    );

     const renderCompactInfoDense = () => (
      <div className="font-sans text-xs">
        <header className="mb-2">
            <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-2xl font-bold" />} />
            <div className="flex justify-between items-center">
                <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role" {...field} className="text-sm text-primary font-semibold" />} />
                <ContactInfo layout="row" />
            </div>
        </header>
        <div className="border-t my-2"></div>
        <main className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <EducationSection />
                <ProjectsSection />
            </div>
             <div className="space-y-2">
                <SkillsSection />
                <AchievementsSection />
            </div>
        </main>
      </div>
    );
    
    const renderCompactReverseSidebar = () => (
        <div className="font-sans text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <main className="md:col-span-2 space-y-4">
                    <header className="mb-4">
                        <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-4xl font-bold" />} />
                        <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role" {...field} className="text-xl text-primary" />} />
                    </header>
                    <ResumeSection title="Objective" onAdd={() => {}} showAdd={false}><FormField control={control} name="objective" render={({ field }) => <ResumeTextarea placeholder="Your career objective..." {...field} />} /></ResumeSection>
                    <ProjectsSection />
                    <AchievementsSection />
                </main>
                <aside className="md:col-span-1 space-y-4 bg-muted/50 p-4 rounded-lg">
                    <PhotoSection />
                    <ContactInfo layout="col"/>
                    <EducationSection />
                    <SkillsSection />
                </aside>
            </div>
        </div>
    );

    const renderCompactHeaderSplit = () => (
        <div className="font-sans">
            <header className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4 pb-4 border-b">
                <div>
                     <FormField control={control} name="name" render={({ field }) => <ResumeInput placeholder="Your Name" {...field} className="text-3xl font-bold" />} />
                     <FormField control={control} name="role" render={({ field }) => <ResumeInput placeholder="Your Role" {...field} className="text-lg text-primary" />} />
                </div>
                 <div className="text-right">
                    <ContactInfo layout="col"/>
                 </div>
            </header>
            <main className="space-y-4">
                <EducationSection />
                <ProjectsSection />
                <SkillsSection />
                <AchievementsSection />
            </main>
        </div>
    );
    
    const renderTemplate = () => {
        switch(templateId) {
            // Modern
            case 'modern-sidebar': return renderModernSidebar();
            case 'modern-header': return renderModernHeader();
            case 'modern-iconic': return renderModernIconic();
            case 'modern-minimalist': return renderModernMinimalist();
            // Classic
            case 'classic-professional': return renderClassicProfessional();
            case 'classic-academic': return renderClassicAcademic();
            case 'classic-timeless': return renderClassicTimeless();
            case 'classic-executive': return renderClassicExecutive();
            // Compact
            case 'compact-two-column': return renderCompactTwoColumn();
            case 'compact-info-dense': return renderCompactInfoDense();
            case 'compact-reverse-sidebar': return renderCompactReverseSidebar();
            case 'compact-header-split': return renderCompactHeaderSplit();
            default: return <div className="text-center text-destructive">Unknown template selected: {templateId}</div>
        }
    }

    return (
      <div ref={ref} className={cn("p-4 sm:p-8 bg-white text-gray-800 shadow-lg max-w-4xl mx-auto print:shadow-none print:p-0")}>
        {renderTemplate()}
      </div>
    );
  }
);
ResumeDisplay.displayName = "ResumeDisplay";

const ResumeSection = ({ title, children, onAdd, showAdd = true, className }: { title: string, children: React.ReactNode, onAdd?: () => void, showAdd?: boolean, className?: string }) => (
  <section className="mb-4">
    <div className={cn("flex justify-between items-center mb-2 pb-1 border-b-2", className)}>
      <h2 className={cn("font-bold uppercase tracking-wider text-md border-primary/50", className)}>{title}</h2>
      {onAdd && showAdd && <Button type="button" variant="ghost" size="icon" onClick={onAdd} className="h-6 w-6 text-primary/70 hover:text-primary"><UserPlus className="h-4 w-4"/></Button>}
    </div>
    <div className="space-y-2">{children}</div>
  </section>
);
