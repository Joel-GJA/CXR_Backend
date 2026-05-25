using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.XR.Management;
using UnityEngine;
using UnityEngine.XR.Management;

public static class XRServerBuildHandler
{
    private static string FindSettingsAssetPath()
    {
        string[] guids = AssetDatabase.FindAssets("t:XRGeneralSettingsPerBuildTarget");
        if (guids.Length > 0)
            return AssetDatabase.GUIDToAssetPath(guids[0]);
        return null;
    }

    [MenuItem("Build/Build Linux Server", priority = 10)]
    public static void BuildLinuxServer()
    {
        string folder = EditorUtility.SaveFolderPanel(
            "Choose Build Output Folder", "Builds", "");

        if (string.IsNullOrEmpty(folder))
        {
            Debug.Log("[BUILD] Server build cancelled by user.");
            return;
        }

        string assetPath = FindSettingsAssetPath();
        string backupPath = null;

        if (assetPath != null)
        {
            backupPath = Path.Combine(Path.GetTempPath(), "XRBackup.asset");
            File.Copy(assetPath, backupPath, overwrite: true);
            Debug.Log($"[BUILD] Backed up XR settings: {assetPath} -> {backupPath}");
        }
        else
        {
            Debug.LogError("[BUILD] Could not find XRGeneralSettingsPerBuildTarget asset!");
        }

        try
        {
            // Clear loaders
            var settings = XRGeneralSettingsPerBuildTarget
                .XRGeneralSettingsForBuildTarget(BuildTargetGroup.Standalone);
            var xrManager = settings?.Manager;
            if (xrManager != null)
            {
                SerializedObject so = new SerializedObject(xrManager);
                SerializedProperty loadersProp = so.FindProperty("m_Loaders");
                if (loadersProp != null)
                {
                    loadersProp.ClearArray();
                    so.ApplyModifiedPropertiesWithoutUndo();
                    AssetDatabase.SaveAssets();
                    Debug.Log("[BUILD] Cleared XR loaders. Building...");
                }
            }

            BuildCommands.BuildLinuxServer(folder + "/CXR_Server.x86_64");
        }
        finally
        {
            // Restore from backup
            if (backupPath != null && File.Exists(backupPath) && assetPath != null)
            {
                File.Copy(backupPath, assetPath, overwrite: true);
                AssetDatabase.Refresh();
                Debug.Log("[BUILD] XR settings restored from backup.");
            }
        }
    }

    [MenuItem("Build/Build Windows Client", priority = 11)]
    public static void BuildWindowsClient()
    {
        string folder = EditorUtility.SaveFolderPanel(
            "Choose Build Output Folder", "Builds", "");

        if (string.IsNullOrEmpty(folder))
        {
            Debug.Log("[BUILD] Windows client build cancelled by user.");
            return;
        }

        BuildCommands.BuildWindowsClient(folder + "/CXR_Client.exe");
    }

    [MenuItem("Build/Build Android Client", priority = 12)]
    public static void BuildAndroidClient()
    {
        string folder = EditorUtility.SaveFolderPanel(
            "Choose Build Output Folder", "Builds", "");

        if (string.IsNullOrEmpty(folder))
        {
            Debug.Log("[BUILD] Android client build cancelled by user.");
            return;
        }

        BuildCommands.BuildAndroidClient(folder + "/CXR_Client.apk");
    }
}
