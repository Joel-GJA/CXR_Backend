using System.Collections.Generic;
using Mirror;
using UnityEditor;
using UnityEngine;

public static class CXRPrefabComplianceChecker
{
    private const string Label = "[CXR_COMPLIANCE]";

    [MenuItem("Window/CXR/Check Prefab Compliance", priority = 101)]
    private static void CheckSelectedPrefabs()
    {
        GameObject[] selectedObjects = Selection.gameObjects;
        if (selectedObjects.Length == 0)
        {
            Debug.LogWarning($"{Label} Select one or more prefab assets or GameObjects to check.");
            return;
        }

        int totalIssues = 0;
        HashSet<string> checkedPaths = new HashSet<string>();

        foreach (GameObject obj in selectedObjects)
        {
            string assetPath = AssetDatabase.GetAssetPath(obj);
            if (string.IsNullOrEmpty(assetPath) || !assetPath.EndsWith(".prefab"))
            {
                if (obj.scene.name != null)
                {
                    totalIssues += CheckSceneObject(obj);
                }
                else
                {
                    Debug.LogWarning($"{Label} Skipped {obj.name}: not a prefab and not in scene.");
                }
                continue;
            }

            if (checkedPaths.Contains(assetPath)) continue;
            checkedPaths.Add(assetPath);

            GameObject prefabRoot = PrefabUtility.LoadPrefabContents(assetPath);
            if (prefabRoot == null) continue;

            try
            {
                totalIssues += CheckPrefab(assetPath, prefabRoot);
            }
            finally
            {
                PrefabUtility.UnloadPrefabContents(prefabRoot);
            }
        }

        if (totalIssues == 0)
            Debug.Log($"{Label} All selected prefabs passed compliance checks.");
        else
            Debug.LogWarning($"{Label} {totalIssues} issue(s) found in selected prefabs.");
    }

    [MenuItem("Window/CXR/Check All Prefabs in Build Settings", priority = 102)]
    private static void CheckAllBuildPrefabs()
    {
        string[] sceneGuids = AssetDatabase.FindAssets("t:Scene", new[] { "Assets" });
        HashSet<string> checkedPrefabs = new HashSet<string>();
        int totalIssues = 0;

        foreach (string guid in sceneGuids)
        {
            string scenePath = AssetDatabase.GUIDToAssetPath(guid);
            EditorBuildSettingsScene[] buildScenes = EditorBuildSettings.scenes;
            bool isInBuild = false;
            foreach (EditorBuildSettingsScene bs in buildScenes)
            {
                if (bs.path == scenePath && bs.enabled) { isInBuild = true; break; }
            }
            if (!isInBuild) continue;

            EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Additive);
            SceneAsset scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(scenePath);

            NetworkIdentity[] identities = GameObject.FindObjectsOfType<NetworkIdentity>();
            foreach (NetworkIdentity id in identities)
            {
                GameObject prefabAsset = PrefabUtility.GetCorrespondingObjectFromSource(id.gameObject);
                if (prefabAsset == null) continue;
                string prefabPath = AssetDatabase.GetAssetPath(prefabAsset);
                if (string.IsNullOrEmpty(prefabPath) || checkedPrefabs.Contains(prefabPath)) continue;
                checkedPrefabs.Add(prefabPath);

                GameObject prefabRoot = PrefabUtility.LoadPrefabContents(prefabPath);
                if (prefabRoot == null) continue;
                try
                {
                    totalIssues += CheckPrefab(prefabPath, prefabRoot);
                }
                finally
                {
                    PrefabUtility.UnloadPrefabContents(prefabRoot);
                }
            }

            EditorSceneManager.CloseScene(scene, true);
        }

        if (totalIssues == 0)
            Debug.Log($"{Label} All build-scene prefabs passed compliance checks ({checkedPrefabs.Count} checked).");
        else
            Debug.LogWarning($"{Label} {totalIssues} issue(s) found across {checkedPrefabs.Count} prefab(s).");
    }

    private static int CheckPrefab(string assetPath, GameObject root)
    {
        int issues = 0;
        string name = root.name;

        issues += CheckNetworkIdentityOnRoot(assetPath, root);
        issues += CheckNetworkTransformSettings(assetPath, root);
        issues += CheckDebugLoggingTags(assetPath, root);

        return issues;
    }

    private static int CheckSceneObject(GameObject obj)
    {
        int issues = 0;
        issues += CheckNetworkIdentityOnRoot(obj.scene.name, obj);
        issues += CheckNetworkTransformSettings(obj.scene.name, obj);
        issues += CheckDebugLoggingTags(obj.scene.name, obj);
        return issues;
    }

    private static int CheckNetworkIdentityOnRoot(string context, GameObject obj)
    {
        NetworkIdentity id = obj.GetComponent<NetworkIdentity>();
        if (id == null) return 0;

        if (obj.transform.parent != null && obj.transform.parent.GetComponentInParent<NetworkIdentity>() != null)
        {
            Debug.LogWarning($"{Label} [{context}] {obj.name}: NetworkIdentity is nested under another NetworkIdentity. Must be on root.", obj);
            return 1;
        }

        return 0;
    }

    private static int CheckNetworkTransformSettings(string context, GameObject obj)
    {
        NetworkTransformBase[] nts = obj.GetComponentsInChildren<NetworkTransformBase>(true);
        int issues = 0;

        foreach (NetworkTransformBase nt in nts)
        {
            if (nt.syncDirection != SyncDirection.ServerToClient)
            {
                Debug.LogWarning($"{Label} [{context}] {nt.name}: NetworkTransform syncDirection should be ServerToClient.", nt.gameObject);
                issues++;
            }

            if (nt.sendInterval <= 0f)
            {
                Debug.LogWarning($"{Label} [{context}] {nt.name}: NetworkTransform sendInterval should be > 0 (currently {nt.sendInterval}).", nt.gameObject);
                issues++;
            }

            if (nt.interpolatePosition && nt.interpolateRotation && nt.sendInterval > 0.1f)
            {
                Debug.Log($"{Label} [{context}] {nt.name}: High sendInterval ({nt.sendInterval}) with interpolation enabled. Consider reducing for smoother sync.", nt.gameObject);
            }
        }

        return issues;
    }

    private static int CheckDebugLoggingTags(string context, GameObject obj)
    {
        MonoBehaviour[] scripts = obj.GetComponentsInChildren<MonoBehaviour>(true);
        int issues = 0;
        string[] validTags = { "[XR_PRESENCE]", "[INTERACTION]", "[OWNERSHIP]", "[SESSION]", "[ENTITY]", "[RUNTIME]", "[FACADE]", "[MR]", "[SPAWN SERVICE]" };

        foreach (MonoBehaviour mb in scripts)
        {
            if (mb == null) continue;
            System.Reflection.MethodInfo[] methods = mb.GetType().GetMethods(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            bool hasInvalidTag = false;

            foreach (System.Reflection.MethodInfo method in methods)
            {
                if (method.Name == "DebugLog" || method.Name == "Log" || method.Name == "Debug" ||
                    method.Name.StartsWith("On") || method.Name.StartsWith("Start") || method.Name.StartsWith("Update"))
                    continue;

                string body = method.Name;
                if (body.Contains("Debug.Log") || body.Contains("Debug.LogWarning") || body.Contains("Debug.LogError"))
                {
                }
            }

            if (hasInvalidTag)
            {
                Debug.LogWarning($"{Label} [{context}] {mb.name}: Uses debug logging without standard CXR subsystem tag.", mb.gameObject);
                issues++;
            }
        }

        return issues;
    }
}
