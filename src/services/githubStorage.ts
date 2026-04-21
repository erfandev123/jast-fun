import axios from 'axios';

const GITHUB_TOKEN = (import.meta.env.VITE_GITHUB_TOKEN || '').trim();
const OWNER = (import.meta.env.VITE_GITHUB_OWNER || '').trim();
const REPO = (import.meta.env.VITE_GITHUB_REPO || '').trim();
const BRANCH = (import.meta.env.VITE_GITHUB_BRANCH || 'main').trim();

// Implement a concurrency queue lock so GitHub single-branch commits don't get 409 Conflict
let isUploading = false;
const uploadQueue: Array<() => Promise<void>> = [];

const processQueue = async () => {
  if (isUploading || uploadQueue.length === 0) return;
  isUploading = true;
  
  while (uploadQueue.length > 0) {
    const task = uploadQueue.shift();
    if (task) {
      try {
        await task();
      } catch (err) {
        console.error('Queue task failed:', err);
      }
    }
  }
  
  isUploading = false;
};

export const uploadMedia = async (file: File | Blob, pathPrefix: string = 'media'): Promise<string> => {
  return new Promise((resolve, reject) => {
    const task = async () => {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((res, rej) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            res(base64);
          };
          reader.onerror = rej;
        });

        reader.readAsDataURL(file);
        const content = await base64Promise;

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const extension = file.type.split('/')[1] || 'bin';
        const filePath = `${pathPrefix}/${fileName}.${extension}`;

        if (!GITHUB_TOKEN || !OWNER || !REPO) {
          throw new Error('GitHub configuration is missing. Configure VITE_GITHUB_TOKEN, _OWNER, and _REPO in settings.');
        }

        let retries = 3;
        let downloadUrl = '';
        let currentBranch = BRANCH;
        
        while (retries > 0) {
          try {
            const payload: any = {
              message: `Upload ${filePath}`,
              content
            };
            if (currentBranch) payload.branch = currentBranch;

            const response = await axios.put(
              `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
              payload,
              {
                headers: {
                  Authorization: `token ${GITHUB_TOKEN}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              }
            );
            downloadUrl = response.data.content.download_url;
            break; // Success
          } catch (uploadErr: any) {
            if (uploadErr.response && uploadErr.response.status === 409 && retries > 1) {
              retries--;
              await new Promise(r => setTimeout(r, 1500)); // wait a bit and retry
              continue;
            }
            
            // Handle "Branch not found" 404 error
            if (uploadErr.response && uploadErr.response.status === 404 && uploadErr.response.data?.message?.includes('not found') && currentBranch) {
               console.warn(`Branch ${currentBranch} not found. Attempting fallback...`);
               if (currentBranch !== 'main') {
                 currentBranch = 'main';
                 retries--;
                 continue;
               } else {
                 // Try omitting branch completely (uses repository default branch)
                 currentBranch = '';
                 retries--;
                 continue;
               }
            }
            
            throw uploadErr;
          }
        }

        if (!downloadUrl) {
           downloadUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${currentBranch || 'main'}/${filePath}`;
        }
        // Get raw URL
        resolve(downloadUrl);
      } catch (error: any) {
        if (error.response) {
          console.error('GitHub Upload Error:', error.response.status, error.response.data);
          reject(new Error(`GitHub Error ${error.response.status}: ${error.response.data.message || 'Check your settings'}`));
        } else {
          console.error('GitHub Upload Error:', error);
          reject(new Error(error.message || 'Failed to upload media to GitHub'));
        }
      }
    };

    uploadQueue.push(task);
    processQueue();
  });
};

export const deleteMedia = async (url: string): Promise<void> => {
  try {
    const filePath = url.split(`/${BRANCH}/`)[1];
    if (!filePath) return;

    // Get file SHA first
    const getResponse = await axios.get(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
        },
      }
    );

    const sha = getResponse.data.sha;

    await axios.delete(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
      {
        data: {
          message: `Delete ${filePath}`,
          sha,
          branch: BRANCH,
        },
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
        },
      }
    );
  } catch (error) {
    console.error('GitHub Delete Error:', error);
  }
};
