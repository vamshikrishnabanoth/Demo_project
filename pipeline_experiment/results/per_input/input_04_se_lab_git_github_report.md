# Level 1 Report: Software Engineering Lab: Git/GitHub Collaborative Workflows & Merge Conflicts
**Input ID**: `input_04_se_lab_git_github` | **Input Type**: `NOTES` | **Content Style**: `PROCEDURAL`

## 1. Quantitative Metrics Comparison

| Evaluation Dimension | Pipeline A (Summary) | Pipeline B (Blueprint) | Metric Interpretation |
| :--- | :---: | :---: | :--- |
| **Source Grounding** | 72.5% | 62.4% | Grounding in source chunks |
| **Source Answerability** | 54.5% | 51.1% | Answerable from provided material |
| **Average Bloom's Level** | 2.0 / 6.0 | 2.8 / 6.0 | Cognitive depth demand |
| **Material Specificity** | 3.95 / 5.0 | 3.63 / 5.0 | Reflection of specific treatment |
| **Genericness Index** | 1.0 / 5.0 | 1.0 / 5.0 | Lower = More uniquely tailored |
| **Question Diversity** | 0.819 | 0.891 | Intra-suite conceptual variety |
| **Composite Quality (Q)** | **0.651** | **0.636** | Standardized Quality Score |

### **DECISION: EQUIVALENT / INCONCLUSIVE**
> Composite quality difference (|delta|=0.015) is within the indifference threshold (0.05).

## 2. Experiment B1: Blueprint Validity Assessment
- **Topics Grounded in Source**: 100.0%
- **Salience Alignment Score**: 4.5 / 5.0
- **Instructional Act Accuracy**: 100.0%
- **Overall Blueprint Validity**: **77.5%**

## 3. Actual Generated Questions

### Pipeline A Questions (Summary)
**Q1 (UNDERSTAND)**: A developer needs to contribute to a public open-source project but does not have direct write access to the original repository. According to the collaborative workflow described, what is the correct initial step to begin this contribution?
- A: Clone the original repository directly and push changes to the main branch.
- B: Create a personal copy of the repository using the 'Fork' mechanism.
- C: Generate a patch file from the original repository and email it to the maintainer.
- D: Request administrative privileges to modify the remote repository configuration.
- *Correct*: **B** | *Explanation*: The correct answer is B because the material defines 'Forking' as creating a personal copy of an existing public repository to contribute without direct write access. Option A is incorrect because pushing directly to the main branch of a repository without write access is not permitted and bypasses the review process. Option C is incorrect because while patch files are a valid method for sharing changes, the specific workflow for contributing to external projects via GitHub involves forking first. Option D is incorrect because the workflow is designed for users who do not have and do not need administrative privileges.

**Q2 (APPLY)**: During a merge operation, a developer encounters conflict markers in a source file. Which of the following sequences correctly represents the procedure to resolve these conflicts and complete the merge?
- A: Run 'git merge --abort', then re-run 'git merge main' with the '--force' flag.
- B: Manually edit the file to remove conflict markers, stage the file with 'git add', and commit the changes.
- C: Delete the conflicting file entirely and run 'git checkout -- .' to restore the original version.
- D: Run 'git rebase --abort' and then apply the changes using 'git format-patch'.
- *Correct*: **B** | *Explanation*: The correct answer is B because the 'Conflict Resolution Workflow' explicitly states that one must identify markers, manually edit the code to resolve discrepancies, remove markers, stage the file with 'git add', and commit. Option A is incorrect because '--abort' reverts the process rather than resolving it, and '--force' is not part of the standard conflict resolution procedure. Option C is incorrect because deleting the file loses data and 'git checkout -- .' would discard local changes, not resolve a merge conflict. Option D is incorrect because it mixes rebase abort procedures with patch generation, which is unrelated to resolving an active merge conflict.

**Q3 (REMEMBER)**: A team member wants to share the changes from a single specific commit (hash abc1234) with another developer via email, without requiring a direct repository connection. Which command should be used?
- A: git diff abc1234 > changes.txt
- B: git format-patch -1 abc1234
- C: git log -1 abc1234 --format=patch
- D: git export abc1234 --output=commit.patch
- *Correct*: **B** | *Explanation*: The correct answer is B because the material specifies that 'git format-patch' is used to create patch files, and the flag '-1' generates a patch for a single commit. Option A is incorrect because 'git diff' creates a raw difference file, not a standard patch file suitable for 'git am' or similar application tools in the context of the lab. Option C is incorrect because 'git log' is for viewing history, not generating patch files. Option D is incorrect because 'git export' is not a standard Git command for this purpose.

**Q4 (APPLY)**: A developer is working on a 'feature' branch and needs to incorporate the latest changes from the 'main' branch to keep their work up-to-date. What is the correct sequence of commands to synchronize the branches?
- A: git checkout main; git merge feature; git checkout feature
- B: git checkout main; git pull origin main; git checkout feature; git merge main
- C: git pull origin feature; git merge main; git push origin feature
- D: git checkout feature; git pull origin main; git merge main
- *Correct*: **B** | *Explanation*: The correct answer is B because the 'Branch Synchronization' mechanism requires switching to main, pulling the latest changes from the remote, switching back to the feature branch, and then merging main into the feature branch. Option A is incorrect because it merges the feature branch into main, which is the opposite of the intended direction (updating the feature branch). Option C is incorrect because it pulls from the feature branch instead of main and does not switch branches correctly. Option D is incorrect because it attempts to pull from main while on the feature branch, which is not the standard synchronization procedure described.

**Q5 (REMEMBER)**: If a merge operation results in a state that is too complex to resolve manually, and the developer wishes to revert the repository to its state before the merge was initiated, which command should be used?
- A: git reset --hard HEAD~1
- B: git merge --abort
- C: git checkout -- .
- D: git revert HEAD
- *Correct*: **B** | *Explanation*: The correct answer is B because the 'Abort Mechanism' section explicitly states that 'git merge --abort' reverts the process to the pre-merge state. Option A is incorrect because 'git reset --hard' is a destructive command that moves the branch pointer and is not the specific command for aborting a merge in progress. Option C is incorrect because 'git checkout -- .' discards uncommitted changes in the working directory but does not abort the merge state itself. Option D is incorrect because 'git revert' creates a new commit that undoes changes, rather than aborting the current merge process.

### Pipeline B Questions (Blueprint)
**Q1 (REMEMBER)**: A developer is setting up a new local Git repository for a solo project. They have already installed Git but have not configured their identity for this specific project. Which sequence of commands correctly initializes the repository and sets the user identity locally for this project only?
- A: git clone <url> && git config --global user.name "Dev" && git config --global user.email "dev@example.com"
- B: git init && git config user.name "Dev" && git config user.email "dev@example.com"
- C: git init && git config --global user.name "Dev" && git config --global user.email "dev@example.com"
- D: git new && git config user.name "Dev" && git config user.email "dev@example.com"
- *Correct*: **B** | *Explanation*: Option B is correct because 'git init' creates a new local repository, and 'git config' without the '--global' flag sets the configuration for the current repository only. Option A is incorrect because 'git clone' is used to copy an existing remote repository, not to initialize a new local one, and '--global' affects all repositories on the machine. Option C is incorrect because using '--global' sets the identity for all projects on the system, not just the current one. Option D is incorrect because 'git new' is not a valid Git command.

**Q2 (UNDERSTAND)**: In a team environment using GitHub, a developer pushes changes to a feature branch and opens a Pull Request (PR) to the main branch. What is the primary purpose of this PR workflow compared to pushing directly to main?
- A: It automatically merges the code into the main branch immediately upon creation to save time.
- B: It serves as a mechanism for code review, discussion, and approval before changes are integrated into the main branch.
- C: It transfers the files from the developer's local machine to the GitHub server without any version control history.
- D: It creates a permanent backup of the feature branch that cannot be deleted or modified.
- *Correct*: **B** | *Explanation*: Option B is correct because the core purpose of a Pull Request is to facilitate code review, discussion, and quality assurance before merging. Option A is incorrect because PRs do not auto-merge by default; they require explicit approval and a merge action. Option C is incorrect because PRs are part of the version control workflow and preserve history; they are not simple file transfers. Option D is incorrect because PRs are temporary objects that are closed after merging or rejection; they are not permanent backups.

**Q3 (APPLY)**: You are merging a feature branch into main and encounter a merge conflict in 'app.js'. You have manually edited 'app.js' to resolve the conflict by removing the conflict markers and keeping the desired code. What is the correct next sequence of commands to complete the merge?
- A: git commit -m "Merge feature" && git push origin main
- B: git add app.js && git commit -m "Resolve merge conflict"
- C: git merge --abort && git checkout main
- D: git stash && git commit -m "Resolve merge conflict"
- *Correct*: **B** | *Explanation*: Option B is correct because after manually resolving a conflict, the file must be staged with 'git add' before it can be committed. Option A is incorrect because 'git commit' will fail if the conflicted file is not staged first. Option C is incorrect because 'git merge --abort' cancels the merge process entirely, reverting to the pre-merge state, which is not the goal if the conflict has been resolved. Option D is incorrect because 'git stash' is used to save uncommitted changes temporarily, not to finalize a merge resolution.

**Q4 (ANALYZE)**: You are analyzing a patch file generated by 'git diff'. The patch contains lines starting with '+' and '-'. What do these symbols represent in the context of applying the patch?
- A: They are literal characters that must be added to or removed from the target file.
- B: They indicate lines to be added ('+') and lines to be removed ('-') from the target file.
- C: They represent binary data that must be decoded before application.
- D: They are comments that are ignored by the 'git apply' command.
- *Correct*: **B** | *Explanation*: Option B is correct because in a unified diff format, '+' denotes lines to be added and '-' denotes lines to be removed. Option A is incorrect because these are control characters for the diff algorithm, not literal content to be inserted. Option C is incorrect because standard text patches use ASCII markers, not binary data. Option D is incorrect because these symbols are essential for the patch application logic and are not ignored.

**Q5 (ANALYZE)**: You attempt to apply a patch to a file, but 'git apply' fails with an error indicating that the context lines do not match. The file exists, but it has been modified since the patch was created. What is the most appropriate strategy to handle this situation?
- A: Use 'git apply --force' to overwrite the current file with the patch content regardless of context.
- B: Manually review the patch and the current file, resolve the differences, and apply the changes manually or with a 3-way merge.
- C: Delete the file and re-clone the repository to reset the state, then apply the patch.
- D: Ignore the error and proceed, as 'git apply' will automatically guess the correct context.
- *Correct*: **B** | *Explanation*: Option B is correct because context mismatches require manual intervention or a 3-way merge to safely integrate changes without losing data. Option A is incorrect because 'git apply' does not have a simple '--force' flag that blindly overwrites; it requires specific flags like '--3way' or manual resolution. Option C is incorrect because deleting and re-cloning is an extreme measure that may lose local changes and is not the standard procedure for context mismatches. Option D is incorrect because 'git apply' does not guess context; it fails strictly if the context does not match.
