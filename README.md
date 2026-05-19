shree ganeshay namah ji !

This is multi org or tenacy system
We need ELS System for Student =KIDS, HIGHSCHOOL, and HIGHER .
In this system we will have three types of user roles (student, teacher, parent,admin and superadmin)
We need to create this as a monorepo having both backend(nodejs) and reactnative mobile app. Backend database is postgres (local postgres is running and full details is avaialble in .env)
We have to store all images and document in s3 bucket(.env have full details of s3)

Mobile app design consideration: We need top bar (top left side my company logo logo.png avaialble in root. right top side we need profile avatar and on click profile setting, profile details and logout button ). Top right before profile there is drop down (if more than one profile) to select profiles(if user created more than one profile small avatar name).

Bottom navbar is Home, Reports Admin (If userrole is admin)

Classes consider for this system is LKG to 12th all classes

SuperaDmin:
Super admin can manage Org
Super admin can manage User and assign roles for given orgs.
SuperAdmin bulk import of students, teacher, subjects, classes and assign based on defined template data structure.

Admin can create a mulitple profiles for a single users (e.g. Teacher/Admin/Student/parent)
Now this user logged into system and top right corner(just before profile), this user can select profile (any one from this Teacher/Admin/Student/parent) and center layout need to change .

Admin of the org can assign and create system.

We can provide temple for all these and apply this can configure entire system.
In the temple users, class, subject, course details will be filled or modify by admin and apply this will create all classes, courses, subjects, assigned students, teachers .

ASSESSMENT APPROACH
SELF ASSESSMENT
ACTUAL PARTICIPANT

RoadMap:

Admin:
Manage Users, Assign roles, Create Classes and Asign Student/Teacher ,
Manage Subject and Assign students/Teachers
Manage course: Assign Student/teacher

Teacher:

    Marking and evaluation:
        Subjects,
        Compition
        Extra curriculam activities

    Planner(classroom):
        Period or learning lessons(when , what course/subject/unit/topic , date and time)
        Exam:
            Select question paper pattern (Questions:[Easy question, medium, hard] , marking, type: mock/Practice, weekly, CT, monthly )
        Assessment:
            Academic Student Analytics:
                student, Subject,topic, exam , marks, class
            Behavirorial Analytics:
            Extra curriculam activities:
    Content Evaluation:
        Teacher will select generated content(content, questions,exams, projects) and teacher can edit it.  Manual vs AI (we can provide a radio button to select AI or manual changes)

    Content manangement
        in this teacher will provide
            Subject:
                Class:
                Title:
                Description:
                Level:
                Expect content type: Audio, Video, Text, Image
            Expected:
                It will generate content prompt with expected content type.

    Question management

Special consideraration:

In this system there are following three types of layout will require in Mobile react native app (KIDS, HIGHSCHOOL, and HIGHER ) .

We need to maintain main

Reports And Analytics:

    Teacher:
        Analtics:
    Student:
        Analyze :
            Question: Wrt course/subject/topic [ Wrong /right/not attemped].  Trends of it and indevidiual
            Scoring: it should be ratings of course/subject/topic. Trends of it and indevidiual

Report:
Teacher, Parent, Priciple
Frequency: daily, monthly, halfyearly
Teacher will have follwoing style of report (teacher_report.png)
Student Report: Same style of Student_report we need.

    Report Content:
        We need to provide detailed report

        Recommendation:
