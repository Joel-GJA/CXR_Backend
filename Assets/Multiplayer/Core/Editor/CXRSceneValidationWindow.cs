using System.Collections.Generic;
using Mirror;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.XR.Interaction.Toolkit;

public class CXRSceneValidationWindow : EditorWindow
{
    private Vector2 scrollPosition;
    private List<ValidationResult> results = new List<ValidationResult>();
    private bool hasRun;

    [MenuItem("Window/CXR/Validate Scene", priority = 100)]
    private static void ShowWindow()
    {
        CXRSceneValidationWindow window = GetWindow<CXRSceneValidationWindow>();
        window.titleContent = new GUIContent("CXR Scene Validation");
        window.minSize = new Vector2(450, 400);
        window.Show();
    }

    private void OnGUI()
    {
        GUILayout.Space(8);
        GUILayout.Label("CXR Scene Validation", EditorStyles.boldLabel);
        GUILayout.Label("Active Scene: " + SceneManager.GetActiveScene().name, EditorStyles.miniLabel);
        GUILayout.Space(8);

        if (GUILayout.Button("Run Validation", GUILayout.Height(32)))
        {
            RunValidation();
        }

        GUILayout.Space(8);

        if (!hasRun)
        {
            GUILayout.Label("Click 'Run Validation' to check the current scene.", EditorStyles.miniLabel);
            return;
        }

        scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);
        int passed = 0;
        int failed = 0;

        for (int i = 0; i < results.Count; i++)
        {
            ValidationResult r = results[i];
            EditorGUILayout.BeginVertical(GUI.skin.box);

            EditorGUILayout.BeginHorizontal();
            string icon = r.level == ResultLevel.Pass ? "check" : r.level == ResultLevel.Warning ? "warning" : "error";
            Color color = r.level == ResultLevel.Pass ? Color.green : r.level == ResultLevel.Warning ? Color.yellow : Color.red;
            GUI.color = color;
            GUILayout.Label(icon, EditorStyles.boldLabel, GUILayout.Width(20));
            GUI.color = Color.white;
            GUILayout.Label(r.checkName, EditorStyles.boldLabel);
            EditorGUILayout.EndHorizontal();

            GUILayout.Label(r.message, EditorStyles.wordWrappedMiniLabel);

            if (!string.IsNullOrEmpty(r.objectPath) && GUILayout.Button("Select", GUILayout.Width(60)))
            {
                GameObject obj = GameObject.Find(r.objectPath);
                if (obj != null) Selection.activeGameObject = obj;
                else Debug.LogWarning($"[CXR_VALIDATION] Object not found: {r.objectPath}");
            }

            EditorGUILayout.EndVertical();
            GUILayout.Space(4);

            if (r.level == ResultLevel.Pass) passed++;
            else failed++;
        }

        EditorGUILayout.EndScrollView();

        GUILayout.Space(8);
        EditorGUILayout.BeginHorizontal();
        GUILayout.Label($"Passed: {passed}  Failed: {failed}", EditorStyles.miniLabel);
        GUILayout.FlexibleSpace();
        GUILayout.Label($"Total: {results.Count}", EditorStyles.miniLabel);
        EditorGUILayout.EndHorizontal();
    }

    private void RunValidation()
    {
        results.Clear();
        hasRun = true;

        CheckNetworkIdentityOnRoot();
        CheckNetworkTransformSettings();
        CheckRegisteredSpawnPrefabs();
        CheckNestedNetworkIdentities();
        CheckRuntimeEventEmitters();
        CheckMRCalibrationZone();
        CheckXROriginPresent();
        CheckNetworkManagerPresent();
        CheckPlayerPrefabAssignment();
        CheckRuntimeParticipantInScene();

        Repaint();
    }

    private void AddPass(string check, string message = "")
    {
        results.Add(new ValidationResult { checkName = check, message = string.IsNullOrEmpty(message) ? "OK" : message, level = ResultLevel.Pass });
    }

    private void AddWarning(string check, string message)
    {
        results.Add(new ValidationResult { checkName = check, message = message, level = ResultLevel.Warning });
    }

    private void AddFail(string check, string message, string objectPath = "")
    {
        results.Add(new ValidationResult { checkName = check, message = message, level = ResultLevel.Fail, objectPath = objectPath });
    }

    private void CheckNetworkIdentityOnRoot()
    {
        NetworkIdentity[] identities = FindObjectsOfType<NetworkIdentity>();
        int issues = 0;
        foreach (NetworkIdentity id in identities)
        {
            if (id.transform.parent != null && id.transform.parent.GetComponent<NetworkIdentity>() != null)
            {
                AddFail("NetworkIdentity on Root", $"{id.name} has NetworkIdentity but is nested under another NetworkIdentity.", GetPath(id.gameObject));
                issues++;
            }
        }
        if (issues == 0) AddPass("NetworkIdentity on Root", "All NetworkIdentities are on root objects.");
    }

    private void CheckNetworkTransformSettings()
    {
        NetworkTransformBase[] nts = FindObjectsOfType<NetworkTransformBase>();
        if (nts.Length == 0)
        {
            AddPass("NetworkTransform Settings", "No NetworkTransform components found.");
            return;
        }
        int issues = 0;
        foreach (NetworkTransformBase nt in nts)
        {
            if (nt.syncDirection != SyncDirection.ServerToClient)
            {
                AddWarning("NetworkTransform Settings", $"{nt.name}: syncDirection should be ServerToClient.", GetPath(nt.gameObject));
                issues++;
            }
        }
        if (issues == 0) AddPass("NetworkTransform Settings", "All NetworkTransform settings are valid.");
    }

    private void CheckRegisteredSpawnPrefabs()
    {
        NetworkManager net = FindObjectOfType<NetworkManager>();
        if (net == null)
        {
            AddFail("Registered Spawn Prefabs", "No NetworkManager found in scene.");
            return;
        }
        List<GameObject> spawnPrefabs = net.spawnPrefabs;
        if (spawnPrefabs == null || spawnPrefabs.Count == 0)
        {
            AddWarning("Registered Spawn Prefabs", "NetworkManager has no registered spawn prefabs.");
            return;
        }
        int issues = 0;
        foreach (GameObject prefab in spawnPrefabs)
        {
            if (prefab == null)
            {
                AddWarning("Registered Spawn Prefabs", "A spawn prefab slot is null. Remove it.");
                issues++;
                continue;
            }
            if (prefab.GetComponent<NetworkIdentity>() == null)
            {
                AddFail("Registered Spawn Prefabs", $"{prefab.name} is registered as spawn prefab but has no NetworkIdentity.");
                issues++;
            }
        }
        if (issues == 0) AddPass("Registered Spawn Prefabs", $"{spawnPrefabs.Count} spawn prefabs registered.");
    }

    private void CheckNestedNetworkIdentities()
    {
        NetworkIdentity[] identities = FindObjectsOfType<NetworkIdentity>();
        int nested = 0;
        foreach (NetworkIdentity id in identities)
        {
            if (id.transform.parent != null && id.transform.parent.GetComponentInParent<NetworkIdentity>() != null && id.transform.parent.GetComponentInParent<NetworkIdentity>() != id)
            {
                AddFail("Nested NetworkIdentities", $"{id.name} is nested under another NetworkIdentity. This is not supported.", GetPath(id.gameObject));
                nested++;
            }
        }
        if (nested == 0) AddPass("Nested NetworkIdentities", "No nested NetworkIdentities found.");
    }

    private void CheckRuntimeEventEmitters()
    {
        RuntimeEventFileSink fileSink = FindObjectOfType<RuntimeEventFileSink>();
        RuntimeMetricsExporter metricsExporter = FindObjectOfType<RuntimeMetricsExporter>();
        if (fileSink != null || metricsExporter != null)
            AddPass("RuntimeEvent Emitters", "RuntimeEvent system is wired. Consumers found in scene.");
        else
            AddWarning("RuntimeEvent Emitters", "No RuntimeEvent consumers found. Add RuntimeEventFileSink or RuntimeMetricsExporter to wire event logging.");
    }

    private void CheckMRCalibrationZone()
    {
        MRCalibrationManager mgr = FindObjectOfType<MRCalibrationManager>();
        if (mgr == null)
        {
            AddWarning("MR Calibration Zone", "No MRCalibrationManager found. Calibration zone check skipped.");
            return;
        }
        SerializedObject so = new SerializedObject(mgr);
        SerializedProperty origin = so.FindProperty("sharedOrigin");
        if (origin == null || origin.objectReferenceValue == null)
        {
            AddFail("MR Calibration Zone", "MRCalibrationManager.sharedOrigin is not assigned.", GetPath(mgr.gameObject));
        }
        else
        {
            AddPass("MR Calibration Zone", $"sharedOrigin assigned: {origin.objectReferenceValue.name}");
        }
    }

    private void CheckXROriginPresent()
    {
        GameObject origin = FindXROrigin();
        if (origin == null)
        {
            AddFail("XR Origin", "No XR Origin found in scene. Add XR Interaction Toolkit setup.");
            return;
        }
        Camera cam = origin.GetComponentInChildren<Camera>();
        ActionBasedController[] controllers = origin.GetComponentsInChildren<ActionBasedController>();
        if (cam == null) AddWarning("XR Origin", "XR Origin has no Camera component.");
        if (controllers.Length == 0) AddWarning("XR Origin", "XR Origin has no ActionBasedControllers.");
        AddPass("XR Origin", $"Found: {origin.name} with {controllers.Length} controller(s).");
    }

    private void CheckNetworkManagerPresent()
    {
        NetworkManager net = FindObjectOfType<NetworkManager>();
        if (net == null)
        {
            AddFail("NetworkManager", "No NetworkManager found. Add XRNetworkManager prefab.");
            return;
        }
        AddPass("NetworkManager", $"Found: {net.name}");
    }

    private void CheckPlayerPrefabAssignment()
    {
        NetworkManager net = FindObjectOfType<NetworkManager>();
        if (net == null) return;
        if (net.playerPrefab == null)
        {
            AddFail("Player Prefab", "NetworkManager.playerPrefab is not set. Assign XRRuntimeParticipantRoot.");
        }
        else if (net.playerPrefab.GetComponent<NetworkIdentity>() == null)
        {
            AddFail("Player Prefab", $"Player prefab {net.playerPrefab.name} has no NetworkIdentity.");
        }
        else
        {
            AddPass("Player Prefab", $"Assigned: {net.playerPrefab.name}");
        }
    }

    private void CheckRuntimeParticipantInScene()
    {
        XRRuntimeParticipant[] participants = FindObjectsOfType<XRRuntimeParticipant>();
        if (participants.Length > 0)
        {
            AddFail("RuntimeParticipant In Scene", $"{participants.Length} XRRuntimeParticipant found in scene. These are networked prefabs and should NOT be placed directly. Set NetworkManager.playerPrefab instead.", GetPath(participants[0].gameObject));
        }
        else
        {
            AddPass("RuntimeParticipant In Scene", "No XRRuntimeParticipant placed directly in scene.");
        }
    }

    private static string GetPath(GameObject obj)
    {
        if (obj == null) return "";
        List<string> parts = new List<string>();
        Transform t = obj.transform;
        while (t != null)
        {
            parts.Add(t.name);
            t = t.parent;
        }
        parts.Reverse();
        return string.Join("/", parts);
    }

    private static GameObject FindXROrigin()
    {
        GameObject origin = GameObject.Find("XR Origin (XR Rig)");
        if (origin != null) return origin;
        origin = GameObject.Find("XR Origin");
        if (origin != null) return origin;
        return FindObjectOfType<Unity.XR.CoreUtils.XROrigin>()?.gameObject;
    }

    private class ValidationResult
    {
        public string checkName;
        public string message;
        public ResultLevel level;
        public string objectPath;
    }

    private enum ResultLevel { Pass, Warning, Fail }
}
